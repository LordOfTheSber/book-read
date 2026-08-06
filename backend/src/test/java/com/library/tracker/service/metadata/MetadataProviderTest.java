package com.library.tracker.service.metadata;

import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Разбор ответов внешних каталогов. Настоящая сеть в тестах не участвует: проверяется то, что
 * зависит от нас, — что из чужого JSON собирается наша карточка и что упавший каталог не роняет
 * запрос вместе с собой.
 */
class MetadataProviderTest {

    @Test
    void openLibraryMapsSearchResultToCard() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        String body = """
                {
                  "docs": [
                    {
                      "key": "/works/OL20605057W",
                      "title": "Задача трёх тел",
                      "subtitle": "The Three-Body Problem",
                      "author_name": ["Лю Цысинь"],
                      "first_publish_year": 2006,
                      "isbn": ["9785171049676", "0439023483"],
                      "language": ["rus"],
                      "number_of_pages_median": 400,
                      "publisher": ["АСТ"],
                      "cover_i": 12345
                    }
                  ]
                }
                """;
        server.expect( requestTo( org.hamcrest.Matchers.containsString( "/search.json" ) ) )
              .andRespond( withSuccess( body, MediaType.APPLICATION_JSON ) );

        OpenLibraryProvider provider =
                new OpenLibraryProvider( builder, "https://openlibrary.org", "https://covers.openlibrary.org" );
        List<ExternalBookResponse> found = provider.search( "задача трёх тел", null, 10 );

        assertThat( found ).hasSize( 1 );
        ExternalBookResponse book = found.get( 0 );
        assertThat( book.getProvider() ).isEqualTo( "OPEN_LIBRARY" );
        assertThat( book.getTitle() ).isEqualTo( "Задача трёх тел" );
        assertThat( book.getAltTitle() ).isEqualTo( "The Three-Body Problem" );
        assertThat( book.getAuthorNames() ).containsExactly( "Лю Цысинь" );
        assertThat( book.getIsbn() ).isEqualTo( "9785171049676" );
        assertThat( book.getPublishedYear() ).isEqualTo( 2006 );
        assertThat( book.getPageCount() ).isEqualTo( 400 );
        assertThat( book.getCoverUrl() ).isEqualTo( "https://covers.openlibrary.org/b/id/12345-L.jpg" );
    }

    /** Каталог лежит — это не ошибка запроса: вторую половину выдачи даст другой каталог. */
    @Test
    void openLibraryReturnsNothingWhenCatalogIsDown() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        server.expect( requestTo( org.hamcrest.Matchers.containsString( "/search.json" ) ) )
              .andRespond( withServerError() );

        OpenLibraryProvider provider =
                new OpenLibraryProvider( builder, "https://openlibrary.org", "https://covers.openlibrary.org" );

        assertThat( provider.search( "что угодно", null, 10 ) ).isEmpty();
    }

    @Test
    void googleBooksPrefersIsbn13AndUpgradesCoverToHttps() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo( builder ).build();
        String body = """
                {
                  "items": [
                    {
                      "id": "abc123",
                      "volumeInfo": {
                        "title": "Piranesi",
                        "authors": ["Susanna Clarke"],
                        "publishedDate": "2020-09-15",
                        "industryIdentifiers": [
                          {"type": "ISBN_10", "identifier": "1526622424"},
                          {"type": "ISBN_13", "identifier": "9781526622426"}
                        ],
                        "pageCount": 272,
                        "language": "en",
                        "publisher": "Bloomsbury",
                        "imageLinks": {"thumbnail": "http://books.google.com/books/content?id=abc123"}
                      }
                    }
                  ]
                }
                """;
        server.expect( requestTo( org.hamcrest.Matchers.containsString( "/volumes" ) ) )
              .andRespond( withSuccess( body, MediaType.APPLICATION_JSON ) );

        GoogleBooksProvider provider = new GoogleBooksProvider( builder, "https://www.googleapis.com/books/v1" );
        List<ExternalBookResponse> found = provider.search( "piranesi", null, 10 );

        assertThat( found ).hasSize( 1 );
        ExternalBookResponse book = found.get( 0 );
        assertThat( book.getIsbn() ).isEqualTo( "9781526622426" );
        assertThat( book.getPublishedYear() ).isEqualTo( 2020 );
        assertThat( book.getPageCount() ).isEqualTo( 272 );
        // Обложка по http на https-странице просто не покажется.
        assertThat( book.getCoverUrl() ).startsWith( "https://" );
    }
}
