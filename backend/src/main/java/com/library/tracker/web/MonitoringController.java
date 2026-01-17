package com.library.tracker.web;

import com.library.tracker.service.MonitoringSettingsService;
import com.library.tracker.service.RequestMetricsService;
import com.library.tracker.web.dto.MonitoringMetricsResponse;
import com.library.tracker.web.dto.MonitoringSettingsRequest;
import com.library.tracker.web.dto.MonitoringSettingsResponse;
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

    private final RequestMetricsService requestMetricsService;
    private final MonitoringSettingsService monitoringSettingsService;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @GetMapping( "/metrics" )
    public MonitoringMetricsResponse getMetrics() {
        return requestMetricsService.snapshot();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @PutMapping( "/metrics" )
    public MonitoringSettingsResponse updateMetricsSettings( @RequestBody MonitoringSettingsRequest request ) {
        return monitoringSettingsService.updateMetricsEnabled( request.isEnabled() );
    }
}
