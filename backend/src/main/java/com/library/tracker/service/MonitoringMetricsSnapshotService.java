package com.library.tracker.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.domain.MonitoringMetricsSnapshot;
import com.library.tracker.repository.MonitoringMetricsSnapshotRepository;
import com.library.tracker.web.dto.EndpointMetricsResponse;
import com.library.tracker.web.dto.MonitoringMetricsResponse;
import com.library.tracker.web.dto.MonitoringMetricsResponse.GlobalMetricsResponse;
import com.library.tracker.web.dto.MonitoringSettingsResponse;
import com.library.tracker.web.dto.NodeMetricsSnapshotResponse;
import com.library.tracker.web.dto.SlowRequestResponse;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MonitoringMetricsSnapshotService {

    private static final TypeReference<List<EndpointMetricsResponse>> ENDPOINTS_TYPE =
            new TypeReference<>() {};
    private static final TypeReference<List<SlowRequestResponse>> SLOW_REQUESTS_TYPE =
            new TypeReference<>() {};

    private final MonitoringMetricsSnapshotRepository monitoringMetricsSnapshotRepository;
    private final MonitoringSettingsService monitoringSettingsService;
    private final ObjectMapper objectMapper;

    public MonitoringMetricsResponse getMetricsOverview() {
        MonitoringSettingsResponse settings = monitoringSettingsService.getSettings();
        List<NodeMetricsSnapshotResponse> nodes = monitoringMetricsSnapshotRepository.findAll()
                                                                                    .stream()
                                                                                    .map( this::toResponse )
                                                                                    .sorted( Comparator.comparing( NodeMetricsSnapshotResponse::getNodeKey ) )
                                                                                    .toList();
        return MonitoringMetricsResponse.builder()
                                        .enabled( settings.isMetricsEnabled() )
                                        .settings( settings )
                                        .nodes( nodes )
                                        .generatedAt( LocalDateTime.now() )
                                        .build();
    }

    public void saveSnapshot( String nodeKey, RequestMetricsService.MetricsSnapshot snapshot ) {
        MonitoringMetricsSnapshot entity = monitoringMetricsSnapshotRepository.findById( nodeKey )
                                                                             .orElseGet( MonitoringMetricsSnapshot::new );
        entity.setNodeKey( nodeKey );
        entity.setCapturedAt( LocalDateTime.now() );
        entity.setTotalRequests( snapshot.global().getTotalRequests() );
        entity.setErrorRequests( snapshot.global().getErrorRequests() );
        entity.setAverageDurationMs( snapshot.global().getAverageDurationMs() );
        entity.setMaxDurationMs( snapshot.global().getMaxDurationMs() );
        entity.setLastRequestAt( snapshot.global().getLastRequestAt() );
        entity.setEndpointsJson( writeJson( snapshot.endpoints() ) );
        entity.setSlowRequestsJson( writeJson( snapshot.slowRequests() ) );
        monitoringMetricsSnapshotRepository.save( entity );
    }

    private NodeMetricsSnapshotResponse toResponse( MonitoringMetricsSnapshot entity ) {
        return NodeMetricsSnapshotResponse.builder()
                                          .nodeKey( entity.getNodeKey() )
                                          .capturedAt( entity.getCapturedAt() )
                                          .global( GlobalMetricsResponse.builder()
                                                                        .totalRequests( entity.getTotalRequests() )
                                                                        .errorRequests( entity.getErrorRequests() )
                                                                        .averageDurationMs( entity.getAverageDurationMs() )
                                                                        .maxDurationMs( entity.getMaxDurationMs() )
                                                                        .lastRequestAt( entity.getLastRequestAt() )
                                                                        .build() )
                                          .endpoints( readJson( entity.getEndpointsJson(), ENDPOINTS_TYPE ) )
                                          .slowRequests( readJson( entity.getSlowRequestsJson(), SLOW_REQUESTS_TYPE ) )
                                          .build();
    }

    private String writeJson( Object value ) {
        if ( value == null ) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString( value );
        } catch ( Exception ex ) {
            return null;
        }
    }

    private <T> List<T> readJson( String value, TypeReference<List<T>> type ) {
        if ( value == null || value.isBlank() ) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue( value, type );
        } catch ( Exception ex ) {
            return Collections.emptyList();
        }
    }
}
