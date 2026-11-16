package com.library.tracker.service;

import com.library.tracker.domain.SessionSettings;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionSettingsRepository;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class SessionSettingsServiceTest {

    @Mock
    private SessionSettingsRepository sessionSettingsRepository;

    @Test
    void getSettingsCreatesDefaultsWhenMissing() {
        when( sessionSettingsRepository.findById( eq( 1L ) ) ).thenReturn( Optional.empty() );
        when( sessionSettingsRepository.save( any( SessionSettings.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        SessionSettingsService service = new SessionSettingsService( sessionSettingsRepository );
        var response = service.getSettings();

        assertThat( response.getSessionTtlMinutes() ).isEqualTo( 30 );
        assertThat( response.getMaxSessionLifetimeMinutes() ).isEqualTo( 24 * 60 );
    }

    @Test
    void updateSettingsValidatesDurations() {
        SessionSettingsService service = new SessionSettingsService( sessionSettingsRepository );

        assertThatThrownBy( () -> service.updateSettings( 0, 5 ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Session TTL must be at least 1 minute" );
    }

    @Test
    void resolveTimingUsesOverrides() {
        SessionSettings settings = new SessionSettings();
        settings.setId( 1L );
        settings.setSessionTtlMinutes( 30 );
        settings.setMaxSessionLifetimeMinutes( 60 );

        when( sessionSettingsRepository.findById( eq( 1L ) ) ).thenReturn( Optional.of( settings ) );

        SessionSettingsService service = new SessionSettingsService( sessionSettingsRepository );
        User user = new User();
        user.setSessionTtlOverrideMinutes( 10 );
        user.setMaxSessionLifetimeOverrideMinutes( 40 );

        SessionSettingsService.SessionTiming timing = service.resolveTiming( user );

        assertThat( timing.sessionTtlMinutes() ).isEqualTo( 10 );
        assertThat( timing.maxSessionLifetimeMinutes() ).isEqualTo( 40 );
    }
}
