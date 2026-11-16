package com.library.tracker.service.metadata;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Забирает обложку из каталога. Скачивает сервер, а не браузер: у каталогов нет CORS-заголовков,
 * а хранилище обложек в любом случае наше.
 * <p>
 * Адрес приходит от клиента, поэтому это готовый SSRF, если не ограничить, куда ходить: список
 * хостов закрыт, схема только https, редиректы за пределы списка обрываются.
 */
@Slf4j
@Service
public class CoverDownloadService {

    /** Та же граница, что у загрузки файлом: обложка не должна раздувать ни хранилище, ни трафик. */
    private static final long MAX_COVER_BYTES = 5L * 1024 * 1024;

    private static final int MAX_REDIRECTS = 3;

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of( "image/png", "image/jpeg", "image/jpg", "image/webp" );

    private final RestClient restClient;
    private final Set<String> allowedHosts;

    public CoverDownloadService( RestClient.Builder builder,
                                 @Value( "${metadata.cover-hosts:covers.openlibrary.org,books.google.com,"
                                         + "books.googleusercontent.com}" ) Set<String> allowedHosts ) {
        this.restClient = builder.build();
        this.allowedHosts = allowedHosts.stream().map( host -> host.toLowerCase( Locale.ROOT ) )
                                        .collect( java.util.stream.Collectors.toUnmodifiableSet() );
    }

    public Downloaded download( String url ) {
        ResponseEntity<byte[]> response = fetch( url );

        byte[] content = response.getBody();
        if ( content == null || content.length == 0 ) {
            throw new IllegalArgumentException( "Каталог вернул пустую обложку" );
        }
        if ( content.length > MAX_COVER_BYTES ) {
            throw new IllegalArgumentException( "Обложка должна быть меньше 5 МБ" );
        }

        String contentType = response.getHeaders().getContentType() == null
                ? null
                : response.getHeaders().getContentType().toString().split( ";" )[0].toLowerCase( Locale.ROOT );
        if ( contentType == null || !ALLOWED_CONTENT_TYPES.contains( contentType ) ) {
            throw new IllegalArgumentException( "По ссылке не изображение поддерживаемого формата" );
        }
        return new Downloaded( content, contentType );
    }

    /**
     * Клиент настроен не ходить по редиректам сам (см. {@code MetadataHttpConfig}): каталог,
     * переславший нас на внутренний адрес, — это тот же SSRF, только в две ступени. Переходы
     * делаются вручную, и каждый следующий хост проверяется по тому же списку.
     */
    private ResponseEntity<byte[]> fetch( String url ) {
        String current = url;
        for ( int hop = 0; hop <= MAX_REDIRECTS; hop++ ) {
            URI uri = validate( current );
            ResponseEntity<byte[]> response;
            try {
                response = restClient.get().uri( uri ).retrieve().toEntity( byte[].class );
            } catch ( Exception ex ) {
                log.warn( "Не удалось скачать обложку {}: {}", uri.getHost(), ex.getMessage() );
                throw new IllegalArgumentException( "Не удалось скачать обложку по ссылке" );
            }
            if ( !response.getStatusCode().is3xxRedirection() ) {
                return response;
            }
            URI location = response.getHeaders().getLocation();
            if ( location == null ) {
                throw new IllegalArgumentException( "Не удалось скачать обложку по ссылке" );
            }
            current = uri.resolve( location ).toString();
        }
        throw new IllegalArgumentException( "Слишком много переадресаций при скачивании обложки" );
    }

    private URI validate( String url ) {
        URI uri;
        try {
            uri = new URI( url );
        } catch ( URISyntaxException ex ) {
            throw new IllegalArgumentException( "Некорректная ссылка на обложку" );
        }
        if ( !"https".equalsIgnoreCase( uri.getScheme() ) || uri.getHost() == null ) {
            throw new IllegalArgumentException( "Ссылка на обложку должна вести по https" );
        }
        if ( !allowedHosts.contains( uri.getHost().toLowerCase( Locale.ROOT ) ) ) {
            throw new IllegalArgumentException( "Обложку можно забрать только из поддерживаемых каталогов" );
        }
        return uri;
    }

    public record Downloaded( byte[] content, String contentType ) { }
}
