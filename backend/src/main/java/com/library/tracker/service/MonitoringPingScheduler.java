package com.library.tracker.service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
@Slf4j
public class MonitoringPingScheduler {

    private final MonitoringSettingsService monitoringSettingsService;
    private final RestTemplateBuilder restTemplateBuilder;
    private final AtomicReference<Instant> lastPingAt = new AtomicReference<>();

    @Value( "${server.port:8080}" )
    private int serverPort;

    @Value( "${server.address:localhost}" )
    private String serverAddress;

    @Scheduled( fixedDelayString = "${monitoring.ping-check-interval:5s}" )
    public void sendPingIfNeeded() {
        MonitoringSettingsService.MonitoringSettingsSnapshot settings = monitoringSettingsService.currentSettings();
        if ( !settings.metricsEnabled() ) {
            return;
        }
        int intervalSeconds = settings.pingIntervalSeconds();
        if ( intervalSeconds <= 0 ) {
            return;
        }
        Instant now = Instant.now();
        Instant lastPing = lastPingAt.get();
        if ( lastPing != null && Duration.between( lastPing, now ).getSeconds() < intervalSeconds ) {
            return;
        }
        lastPingAt.set( now );

        String target = resolvePingUrl( settings.pingPath() );
        try {
            restTemplateBuilder.build().getForEntity( target, String.class );
        } catch ( Exception ex ) {
            log.warn( "Monitoring ping failed for {}", target, ex );
        }
    }

    private String resolvePingUrl( String path ) {
        if ( path != null && ( path.startsWith( "http://" ) || path.startsWith( "https://" ) ) ) {
            return path;
        }
        String normalizedPath = path == null ? "/api/v1/monitoring/ping" : path.trim();
        return UriComponentsBuilder.newInstance()
                                   .scheme( "http" )
                                   .host( serverAddress )
                                   .port( serverPort )
                                   .path( normalizedPath.startsWith( "/" ) ? normalizedPath : "/" + normalizedPath )
                                   .build()
                                   .toUriString();
    }
}
