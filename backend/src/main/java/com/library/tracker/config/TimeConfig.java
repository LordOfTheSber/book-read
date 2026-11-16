package com.library.tracker.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Часы отдельным бином: даты начала и завершения чтения выставляет сама смена статуса,
 * и без подменяемого источника времени эту логику нельзя было бы проверить тестом.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
