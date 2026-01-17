package com.library.tracker.service;

import com.library.tracker.web.dto.EndpointMetricsResponse;
import com.library.tracker.web.dto.SlowRequestResponse;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.LongAdder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RequestMetricsService {

    private static final int MAX_ENDPOINTS = 200;
    private static final int MAX_ENDPOINTS_EXPORT = 50;
    private static final int MAX_SLOW_REQUESTS = 50;
    private static final long SLOW_REQUEST_THRESHOLD_MS = 1000;

    private final MonitoringSettingsService monitoringSettingsService;
    private final Map<String, EndpointStats> endpointStats = new ConcurrentHashMap<>();
    private final LongAdder totalRequests = new LongAdder();
    private final LongAdder errorRequests = new LongAdder();
    private final LongAdder totalDuration = new LongAdder();
    private final AtomicLong maxDuration = new AtomicLong();
    private final AtomicReference<LocalDateTime> lastRequestAt = new AtomicReference<>();
    private final Deque<SlowRequestResponse> slowRequests = new ArrayDeque<>();
    private final Object slowRequestsLock = new Object();

    public boolean isEnabled() {
        return monitoringSettingsService.isMetricsEnabled();
    }

    public void recordRequest( String method, String path, int status, long durationMs ) {
        if ( !isEnabled() ) {
            return;
        }
        totalRequests.increment();
        totalDuration.add( durationMs );
        lastRequestAt.set( LocalDateTime.now() );
        updateMax( maxDuration, durationMs );

        if ( status >= 500 ) {
            errorRequests.increment();
        }

        String key = method + " " + path;
        EndpointStats stats = endpointStats.get( key );
        if ( stats == null ) {
            if ( endpointStats.size() >= MAX_ENDPOINTS ) {
                return;
            }
            EndpointStats created = new EndpointStats( method, path );
            EndpointStats existing = endpointStats.putIfAbsent( key, created );
            stats = existing != null ? existing : created;
        }
        stats.record( status, durationMs );

        if ( durationMs >= SLOW_REQUEST_THRESHOLD_MS ) {
            addSlowRequest( SlowRequestResponse.builder()
                                               .method( method )
                                               .path( path )
                                               .status( status )
                                               .durationMs( durationMs )
                                               .occurredAt( LocalDateTime.now() )
                                               .build() );
        }
    }

    public MetricsSnapshot snapshot() {
        List<EndpointMetricsResponse> endpoints = endpointStats.values().stream()
                                                               .map( EndpointStats::toResponse )
                                                               .sorted( Comparator.comparingLong( EndpointMetricsResponse::getMaxDurationMs )
                                                                                  .reversed() )
                                                               .limit( MAX_ENDPOINTS_EXPORT )
                                                               .toList();
        List<SlowRequestResponse> slowRequestsSnapshot;
        synchronized ( slowRequestsLock ) {
            slowRequestsSnapshot = new ArrayList<>( slowRequests );
        }
        long total = totalRequests.sum();
        long totalDurationMs = totalDuration.sum();
        double average = total > 0 ? (double) totalDurationMs / total : 0.0;

        return new MetricsSnapshot(
                GlobalSnapshot.builder()
                              .totalRequests( total )
                              .errorRequests( errorRequests.sum() )
                              .averageDurationMs( average )
                              .maxDurationMs( maxDuration.get() )
                              .lastRequestAt( lastRequestAt.get() )
                              .build(),
                endpoints,
                slowRequestsSnapshot );
    }

    private void addSlowRequest( SlowRequestResponse slowRequest ) {
        synchronized ( slowRequestsLock ) {
            slowRequests.addLast( slowRequest );
            while ( slowRequests.size() > MAX_SLOW_REQUESTS ) {
                slowRequests.removeFirst();
            }
        }
    }

    private void updateMax( AtomicLong holder, long value ) {
        holder.updateAndGet( current -> Math.max( current, value ) );
    }

    private static class EndpointStats {

        private final String method;
        private final String path;
        private final LongAdder totalRequests = new LongAdder();
        private final LongAdder errorRequests = new LongAdder();
        private final LongAdder totalDuration = new LongAdder();
        private final AtomicLong maxDuration = new AtomicLong();
        private final AtomicLong lastDuration = new AtomicLong();
        private final AtomicReference<LocalDateTime> lastRequestAt = new AtomicReference<>();

        private EndpointStats( String method, String path ) {
            this.method = method;
            this.path = path;
        }

        private void record( int status, long durationMs ) {
            totalRequests.increment();
            totalDuration.add( durationMs );
            lastDuration.set( durationMs );
            lastRequestAt.set( LocalDateTime.now() );
            if ( status >= 500 ) {
                errorRequests.increment();
            }
            maxDuration.updateAndGet( current -> Math.max( current, durationMs ) );
        }

        private EndpointMetricsResponse toResponse() {
            long total = totalRequests.sum();
            long totalDurationMs = totalDuration.sum();
            double average = total > 0 ? (double) totalDurationMs / total : 0.0;

            return EndpointMetricsResponse.builder()
                                          .method( method )
                                          .path( path )
                                          .totalRequests( total )
                                          .errorRequests( errorRequests.sum() )
                                          .averageDurationMs( average )
                                          .maxDurationMs( maxDuration.get() )
                                          .lastDurationMs( lastDuration.get() )
                                          .lastRequestAt( lastRequestAt.get() )
                                          .build();
        }
    }

    public record MetricsSnapshot(
            GlobalSnapshot global,
            List<EndpointMetricsResponse> endpoints,
            List<SlowRequestResponse> slowRequests ) {
    }

    @lombok.Value
    @lombok.Builder
    public static class GlobalSnapshot {

        long totalRequests;
        long errorRequests;
        double averageDurationMs;
        long maxDurationMs;
        LocalDateTime lastRequestAt;
    }
}
