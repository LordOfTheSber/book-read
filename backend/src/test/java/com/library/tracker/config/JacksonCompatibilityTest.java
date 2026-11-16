package com.library.tracker.config;

import com.library.tracker.web.dto.AuthResponse;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Контракт JSON сложился на Jackson 2. Тест держит те его умолчания, на которые опираются клиент
 * и резервные копии и которые в Jackson 3 стали другими.
 */
@SpringBootTest( classes = { JacksonConfig.class, JacksonAutoConfiguration.class } )
class JacksonCompatibilityTest {

    @Autowired
    private JsonMapper jsonMapper;

    /** У {@code @Value @Builder} конструктор с пакетной видимостью — Jackson 3 сам его не берёт. */
    @Test
    void readsLombokValueObjectsThroughNonPublicConstructor() {
        AuthResponse response = jsonMapper.readValue( "{\"deviceRemembered\":true}", AuthResponse.class );

        assertThat( response.isDeviceRemembered() ).isTrue();
    }

    /** В старых резервных копиях на месте примитива встречается null. */
    @Test
    void nullForPrimitiveIsReadAsDefault() {
        AuthResponse response = jsonMapper.readValue( "{\"deviceRemembered\":null}", AuthResponse.class );

        assertThat( response.isDeviceRemembered() ).isFalse();
    }

    /** Клиент новее сервера может прислать поле, которого сервер ещё не знает. */
    @Test
    void unknownPropertiesAreIgnored() {
        AuthResponse response = jsonMapper.readValue( "{\"deviceRemembered\":true,\"future\":1}",
                                                      AuthResponse.class );

        assertThat( response.isDeviceRemembered() ).isTrue();
    }

    /** Даты уходят клиенту строкой ISO-8601, а не числом. */
    @Test
    void datesAreWrittenAsIsoStrings() {
        String json = jsonMapper.writeValueAsString( OffsetDateTime.of( 2025, 1, 2, 3, 4, 5, 0, ZoneOffset.UTC ) );

        assertThat( json ).isEqualTo( "\"2025-01-02T03:04:05Z\"" );
    }

    /** Порядок свойств в ответе — как объявлено в классе, а не по алфавиту. */
    @Test
    void keepsDeclarationOrderOfProperties() {
        String json = jsonMapper.writeValueAsString( AuthResponse.builder().build() );

        assertThat( json.indexOf( "\"user\"" ) ).isLessThan( json.indexOf( "\"session\"" ) );
        assertThat( json.indexOf( "\"session\"" ) ).isLessThan( json.indexOf( "\"deviceRemembered\"" ) );
    }
}
