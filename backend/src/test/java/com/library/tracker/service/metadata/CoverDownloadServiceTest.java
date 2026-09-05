package com.library.tracker.service.metadata;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Адрес обложки приходит от клиента, поэтому это готовый SSRF, если не ограничить, куда ходить.
 * Здесь проверяется именно ограничение, а не скачивание.
 */
class CoverDownloadServiceTest {

    private static final Set<String> ALLOWED = Set.of( "covers.openlibrary.org", "books.google.com" );

    @Test
    void downloadsCoverFromAllowedHost() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        server.expect( requestTo( "https://covers.openlibrary.org/b/id/1-L.jpg" ) )
              .andRespond( withSuccess( new byte[] { 1, 2, 3 }, MediaType.IMAGE_JPEG ) );

        CoverDownloadService service = new CoverDownloadService( builder, ALLOWED );
        CoverDownloadService.Downloaded downloaded =
                service.download( "https://covers.openlibrary.org/b/id/1-L.jpg" );

        assertThat( downloaded.content() ).hasSize( 3 );
        assertThat( downloaded.contentType() ).isEqualTo( "image/jpeg" );
    }

    @Test
    void rejectsHostOutsideAllowList() {
        CoverDownloadService service = new CoverDownloadService( RestClient.builder(), ALLOWED );

        assertThatThrownBy( () -> service.download( "https://example.com/cover.jpg" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "поддерживаемых каталогов" );
    }

    /** Внутренние адреса ходят по http и без имени хоста — обе формы отсекаются схемой. */
    @Test
    void rejectsNonHttpsScheme() {
        CoverDownloadService service = new CoverDownloadService( RestClient.builder(), ALLOWED );

        assertThatThrownBy( () -> service.download( "http://169.254.169.254/latest/meta-data/" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "https" );
    }

    /** Переадресация на чужой хост — тот же SSRF, только в две ступени. */
    @Test
    void rejectsRedirectOutsideAllowList() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        HttpHeaders headers = new HttpHeaders();
        headers.add( HttpHeaders.LOCATION, "https://internal.example.com/secret" );
        server.expect( requestTo( "https://covers.openlibrary.org/b/id/1-L.jpg" ) )
              .andRespond( withStatus( HttpStatus.FOUND ).headers( headers ) );

        CoverDownloadService service = new CoverDownloadService( builder, ALLOWED );

        assertThatThrownBy( () -> service.download( "https://covers.openlibrary.org/b/id/1-L.jpg" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "поддерживаемых каталогов" );
    }

    @Test
    void rejectsNonImageContent() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        server.expect( requestTo( "https://books.google.com/x" ) )
              .andRespond( withSuccess( "<html/>", MediaType.TEXT_HTML ) );

        CoverDownloadService service = new CoverDownloadService( builder, ALLOWED );

        assertThatThrownBy( () -> service.download( "https://books.google.com/x" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "не изображение" );
    }
}
