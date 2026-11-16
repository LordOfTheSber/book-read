package com.library.tracker.service;

import com.library.tracker.domain.MonitoringSettings;
import com.library.tracker.repository.MonitoringSettingsRepository;
import com.library.tracker.web.dto.MonitoringSettingsResponse;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MonitoringSettingsService {

    private static final long SETTINGS_ROW_ID = 1L;
    private static final int DEFAULT_PING_INTERVAL_SECONDS = 30;
    private static final String DEFAULT_PING_PATH = "/api/v1/monitoring/ping";

    private final MonitoringSettingsRepository monitoringSettingsRepository;
    private final AtomicBoolean initialized = new AtomicBoolean( false );
    private final AtomicBoolean metricsEnabled = new AtomicBoolean( true );
    private final AtomicReference<MonitoringSettingsSnapshot> cachedSettings = new AtomicReference<>(
            new MonitoringSettingsSnapshot( true, DEFAULT_PING_INTERVAL_SECONDS, DEFAULT_PING_PATH ) );

    public MonitoringSettingsResponse getSettings() {
        MonitoringSettings settings = loadOrCreateDefaults();
        updateCache( settings );
        return toResponse( settings );
    }

    public boolean isMetricsEnabled() {
        ensureInitialized();
        return metricsEnabled.get();
    }

    public MonitoringSettingsSnapshot currentSettings() {
        ensureInitialized();
        return cachedSettings.get();
    }

    public MonitoringSettingsResponse updateMetricsEnabled( boolean enabled ) {
        MonitoringSettings settings = loadOrCreateDefaults();
        settings.setMetricsEnabled( enabled );
        MonitoringSettings saved = monitoringSettingsRepository.save( settings );
        updateCache( saved );
        return toResponse( saved );
    }

    public MonitoringSettingsResponse updatePingSettings( Integer pingIntervalSeconds, String pingPath ) {
        MonitoringSettings settings = loadOrCreateDefaults();
        settings.setPingIntervalSeconds( normalizePingInterval( pingIntervalSeconds ) );
        settings.setPingPath( normalizePingPath( pingPath ) );
        MonitoringSettings saved = monitoringSettingsRepository.save( settings );
        updateCache( saved );
        return toResponse( saved );
    }

    private synchronized void ensureInitialized() {
        if ( initialized.get() ) {
            return;
        }
        MonitoringSettings settings = loadOrCreateDefaults();
        updateCache( settings );
    }

    private MonitoringSettings loadOrCreateDefaults() {
        return monitoringSettingsRepository.findById( SETTINGS_ROW_ID )
                                           .orElseGet( () -> {
                                               MonitoringSettings defaults = new MonitoringSettings();
                                               defaults.setId( SETTINGS_ROW_ID );
                                               defaults.setMetricsEnabled( true );
                                               defaults.setPingIntervalSeconds( DEFAULT_PING_INTERVAL_SECONDS );
                                               defaults.setPingPath( DEFAULT_PING_PATH );
                                               return monitoringSettingsRepository.save( defaults );
                                           } );
    }

    private MonitoringSettingsResponse toResponse( MonitoringSettings settings ) {
        return MonitoringSettingsResponse.builder()
                                         .metricsEnabled( Boolean.TRUE.equals( settings.getMetricsEnabled() ) )
                                         .pingIntervalSeconds( settings.getPingIntervalSeconds() )
                                         .pingPath( settings.getPingPath() )
                                         .updatedAt( settings.getUpdatedAt() )
                                         .build();
    }

    private void updateCache( MonitoringSettings settings ) {
        boolean enabled = Boolean.TRUE.equals( settings.getMetricsEnabled() );
        metricsEnabled.set( enabled );
        cachedSettings.set( new MonitoringSettingsSnapshot(
                enabled,
                normalizePingInterval( settings.getPingIntervalSeconds() ),
                normalizePingPath( settings.getPingPath() ) ) );
        initialized.set( true );
    }

    private int normalizePingInterval( Integer value ) {
        if ( value == null || value <= 0 ) {
            return DEFAULT_PING_INTERVAL_SECONDS;
        }
        return Math.max( 5, value );
    }

    private String normalizePingPath( String pingPath ) {
        if ( !org.springframework.util.StringUtils.hasText( pingPath ) ) {
            return DEFAULT_PING_PATH;
        }
        return pingPath.trim();
    }

    public record MonitoringSettingsSnapshot( boolean metricsEnabled, int pingIntervalSeconds, String pingPath ) {
    }
}
