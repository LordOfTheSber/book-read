package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.SessionSettings;
import com.library.tracker.repository.SessionSettingsRepository;
import com.library.tracker.service.SessionSettingsService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
// Без этого Spring Boot подменил бы контейнер встроенной БД.
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( { SessionSettingsService.class, JpaConfig.class } )
class SessionSettingsServiceIntegrationTest extends PostgresContainerTest {

    @Autowired
    private SessionSettingsService sessionSettingsService;

    @Autowired
    private SessionSettingsRepository sessionSettingsRepository;

    @Test
    void getSettingsCreatesDefaults() {
        var response = sessionSettingsService.getSettings();

        assertThat( response.getSessionTtlMinutes() ).isEqualTo( 30 );
        assertThat( response.getMaxSessionLifetimeMinutes() ).isEqualTo( 24 * 60 );
        assertThat( sessionSettingsRepository.findById( 1L ) )
                .map( SessionSettings::getSessionTtlMinutes )
                .contains( 30 );
    }

    @Test
    void updateSettingsPersistsChanges() {
        var response = sessionSettingsService.updateSettings( 15, 120 );

        assertThat( response.getSessionTtlMinutes() ).isEqualTo( 15 );
        assertThat( response.getMaxSessionLifetimeMinutes() ).isEqualTo( 120 );
        assertThat( sessionSettingsRepository.findById( 1L ) )
                .map( SessionSettings::getMaxSessionLifetimeMinutes )
                .contains( 120 );
    }
}
