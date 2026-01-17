package com.library.tracker.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MonitoringMetricsSnapshotScheduler {

    private final RequestMetricsService requestMetricsService;
    private final MonitoringSettingsService monitoringSettingsService;
    private final MonitoringMetricsSnapshotService monitoringMetricsSnapshotService;
    private final NodeInfoProvider nodeInfoProvider;

    @Scheduled( fixedDelayString = "${monitoring.metrics-snapshot-interval:10s}" )
    public void captureSnapshot() {
        if ( !monitoringSettingsService.isMetricsEnabled() ) {
            return;
        }
        try {
            String nodeKey = nodeInfoProvider.captureSnapshot().nodeKey();
            monitoringMetricsSnapshotService.saveSnapshot( nodeKey, requestMetricsService.snapshot() );
        } catch ( Exception ex ) {
            log.warn( "Failed to capture monitoring metrics snapshot", ex );
        }
    }
}
