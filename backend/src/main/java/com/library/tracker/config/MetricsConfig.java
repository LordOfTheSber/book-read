package com.library.tracker.config;

import com.library.tracker.service.NodeInfoProvider;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.config.MeterFilter;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Собственные страницы мониторинга показывают то, что реплика накопила в памяти: при нескольких
 * подах цифры зависят от того, куда попал запрос, и обнуляются при рестарте. Actuator отдаёт те же
 * запросы стандартной метрикой {@code http.server.requests} на {@code /actuator/prometheus} — там
 * они складываются по репликам и переживают перезапуск, потому что историю хранит Prometheus.
 * <p>
 * Метка {@code node} совпадает с ключом узла на странице «Узлы», так что ряд из Prometheus и строка
 * в интерфейсе указывают на один и тот же под.
 */
@Configuration
@RequiredArgsConstructor
public class MetricsConfig {

    /** Верхняя граница числа рядов на один эндпоинт: защищает от взрыва кардинальности. */
    private static final int MAX_URI_TAGS = 200;

    private final NodeInfoProvider nodeInfoProvider;

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
        return registry -> registry.config()
                                   .commonTags( "application", "book-read-backend",
                                                "node", nodeInfoProvider.nodeKey() )
                                   .meterFilter( MeterFilter.maximumAllowableTags(
                                           "http.server.requests", "uri", MAX_URI_TAGS,
                                           MeterFilter.deny() ) );
    }
}
