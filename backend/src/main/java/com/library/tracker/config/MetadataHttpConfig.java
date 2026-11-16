package com.library.tracker.config;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * Настройки исходящих запросов к внешним каталогам. Без таймаутов зависший чужой сервис держал бы
 * поток обработки запроса до упора, а без запрета на редиректы скачивание обложки по адресу
 * от клиента превращалось бы в SSRF через переадресацию.
 */
@Configuration
public class MetadataHttpConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds( 5 );
    private static final Duration READ_TIMEOUT = Duration.ofSeconds( 8 );

    @Bean
    public RestClientCustomizer outboundRestClientCustomizer() {
        HttpClient httpClient = HttpClient.newBuilder()
                                          .followRedirects( HttpClient.Redirect.NEVER )
                                          .connectTimeout( CONNECT_TIMEOUT )
                                          .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory( httpClient );
        factory.setReadTimeout( READ_TIMEOUT );
        return builder -> builder.requestFactory( factory );
    }
}
