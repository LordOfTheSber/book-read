package com.library.tracker.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.MapperFeature;

/**
 * Донастройка Jackson 3 до поведения, на котором сложился контракт API и формат резервных копий.
 * <p>
 * Основную часть умолчаний Jackson 2 возвращает {@code spring.jackson.use-jackson2-defaults}, но
 * два отличия остаются. Jackson 3 собирает объект только через публичный конструктор, и в режиме
 * совместимости перестаёт читать имена его параметров (в Spring Boot 3 это делал отдельный
 * модуль). На обоих держатся DTO с {@code @Value @Builder}: Lombok даёт им конструктор с пакетной
 * видимостью и без аннотаций, и без этой настройки такие классы не читаются из JSON вовсе —
 * «no Creators exist».
 */
@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer lombokValueObjectsCustomizer() {
        return builder -> builder.enable( MapperFeature.DETECT_PARAMETER_NAMES )
                                 .changeDefaultVisibility(
                                         visibility -> visibility.withCreatorVisibility( Visibility.ANY ) );
    }
}
