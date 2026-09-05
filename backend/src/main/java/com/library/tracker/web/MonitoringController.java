package com.library.tracker.web;

import com.library.tracker.service.MonitoringMetricsSnapshotService;
import com.library.tracker.service.MonitoringSettingsService;
import com.library.tracker.web.dto.MonitoringMetricsResponse;
import com.library.tracker.web.dto.MonitoringSettingsResponse;
import com.library.tracker.web.dto.MonitoringSettingsUpdateRequest;
import com.library.tracker.web.dto.MonitoringToggleRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/monitoring" )
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringMetricsSnapshotService monitoringMetricsSnapshotService;
    private final MonitoringSettingsService monitoringSettingsService;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @GetMapping( "/metrics" )
    public MonitoringMetricsResponse getMetrics() {
        return monitoringMetricsSnapshotService.getMetricsOverview();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @PutMapping( "/metrics" )
    public MonitoringSettingsResponse updateMetricsSettings( @RequestBody MonitoringToggleRequest request ) {
        return monitoringSettingsService.updateMetricsEnabled( request.isEnabled() );
    }

    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    @GetMapping( "/settings" )
    public MonitoringSettingsResponse getSettings() {
        return monitoringSettingsService.getSettings();
    }

    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    @PutMapping( "/settings" )
    public MonitoringSettingsResponse updateSettings( @RequestBody MonitoringSettingsUpdateRequest request ) {
        return monitoringSettingsService.updatePingSettings( request.getPingIntervalSeconds(), request.getPingPath() );
    }

    @GetMapping( "/ping" )
    public String ping() {
        return "ok";
    }
}
