package com.library.tracker.service;

import com.library.tracker.domain.MonitoringSettings;
import com.library.tracker.repository.MonitoringSettingsRepository;
import com.library.tracker.web.dto.MonitoringSettingsResponse;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MonitoringSettingsService {

    private static final long SETTINGS_ROW_ID = 1L;

    private final MonitoringSettingsRepository monitoringSettingsRepository;
    private final AtomicBoolean initialized = new AtomicBoolean( false );
    private final AtomicBoolean metricsEnabled = new AtomicBoolean( true );

    public MonitoringSettingsResponse getSettings() {
        MonitoringSettings settings = loadOrCreateDefaults();
        metricsEnabled.set( Boolean.TRUE.equals( settings.getMetricsEnabled() ) );
        initialized.set( true );
        return toResponse( settings );
    }

    public boolean isMetricsEnabled() {
        ensureInitialized();
        return metricsEnabled.get();
    }

    public MonitoringSettingsResponse updateMetricsEnabled( boolean enabled ) {
        MonitoringSettings settings = loadOrCreateDefaults();
        settings.setMetricsEnabled( enabled );
        MonitoringSettings saved = monitoringSettingsRepository.save( settings );
        metricsEnabled.set( Boolean.TRUE.equals( saved.getMetricsEnabled() ) );
        initialized.set( true );
        return toResponse( saved );
    }

    private synchronized void ensureInitialized() {
        if ( initialized.get() ) {
            return;
        }
        MonitoringSettings settings = loadOrCreateDefaults();
        metricsEnabled.set( Boolean.TRUE.equals( settings.getMetricsEnabled() ) );
        initialized.set( true );
    }

    private MonitoringSettings loadOrCreateDefaults() {
        return monitoringSettingsRepository.findById( SETTINGS_ROW_ID )
                                           .orElseGet( () -> {
                                               MonitoringSettings defaults = new MonitoringSettings();
                                               defaults.setId( SETTINGS_ROW_ID );
                                               defaults.setMetricsEnabled( true );
                                               return monitoringSettingsRepository.save( defaults );
                                           } );
    }

    private MonitoringSettingsResponse toResponse( MonitoringSettings settings ) {
        return MonitoringSettingsResponse.builder()
                                         .metricsEnabled( Boolean.TRUE.equals( settings.getMetricsEnabled() ) )
                                         .updatedAt( settings.getUpdatedAt() )
                                         .build();
    }
}
