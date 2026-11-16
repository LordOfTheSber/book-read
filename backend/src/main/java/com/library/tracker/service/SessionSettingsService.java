package com.library.tracker.service;

import com.library.tracker.domain.SessionSettings;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionSettingsRepository;
import com.library.tracker.web.dto.SessionSettingsResponse;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class SessionSettingsService {

    private static final long SETTINGS_ROW_ID = 1L;

    private final SessionSettingsRepository sessionSettingsRepository;

    public SessionSettingsResponse getSettings() {
        SessionSettings settings = loadOrCreateDefaults();
        return SessionSettingsResponse.builder()
                                      .sessionTtlMinutes( settings.getSessionTtlMinutes() )
                                      .maxSessionLifetimeMinutes( settings.getMaxSessionLifetimeMinutes() )
                                      .build();
    }

    public SessionSettingsResponse updateSettings( int sessionTtlMinutes, int maxSessionLifetimeMinutes ) {
        validateDurations( sessionTtlMinutes, maxSessionLifetimeMinutes );
        SessionSettings settings = loadOrCreateDefaults();
        settings.setSessionTtlMinutes( sessionTtlMinutes );
        settings.setMaxSessionLifetimeMinutes( maxSessionLifetimeMinutes );
        SessionSettings saved = sessionSettingsRepository.save( settings );
        return SessionSettingsResponse.builder()
                                      .sessionTtlMinutes( saved.getSessionTtlMinutes() )
                                      .maxSessionLifetimeMinutes( saved.getMaxSessionLifetimeMinutes() )
                                      .build();
    }

    public SessionTiming resolveTiming( User user ) {
        SessionSettings settings = loadOrCreateDefaults();
        int ttl = user.getSessionTtlOverrideMinutes() != null ? user.getSessionTtlOverrideMinutes()
                                                              : settings.getSessionTtlMinutes();
        int maxLifetime = user.getMaxSessionLifetimeOverrideMinutes() != null
                ? user.getMaxSessionLifetimeOverrideMinutes()
                : settings.getMaxSessionLifetimeMinutes();
        validateDurations( ttl, maxLifetime );
        return new SessionTiming( ttl, maxLifetime );
    }

    private void validateDurations( int ttl, int maxLifetime ) {
        if ( ttl < 1 ) {
            throw new IllegalArgumentException( "Session TTL must be at least 1 minute" );
        }
        if ( maxLifetime < ttl ) {
            throw new IllegalArgumentException( "Max session lifetime cannot be shorter than TTL" );
        }
    }

    private SessionSettings loadOrCreateDefaults() {
        return sessionSettingsRepository.findById( SETTINGS_ROW_ID )
                                        .orElseGet( () -> {
                                            SessionSettings defaults = new SessionSettings();
                                            defaults.setId( SETTINGS_ROW_ID );
                                            defaults.setSessionTtlMinutes( 30 );
                                            defaults.setMaxSessionLifetimeMinutes( 24 * 60 );
                                            return sessionSettingsRepository.save( defaults );
                                        } );
    }

    public record SessionTiming( int sessionTtlMinutes, int maxSessionLifetimeMinutes ) {

        public long ttlSeconds() {
            return sessionTtlMinutes * 60L;
        }
    }
}
