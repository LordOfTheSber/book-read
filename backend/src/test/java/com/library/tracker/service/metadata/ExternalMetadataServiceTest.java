package com.library.tracker.service.metadata;

import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExternalMetadataServiceTest {

    /** Первый каталог не должен вытеснять второй: выдача перемежается по одной находке. */
    @Test
    void interleavesResultsFromBothCatalogs() {
        ExternalMetadataService service = new ExternalMetadataService( List.of(
                stub( "A", book( "A", "Первая", "1" ), book( "A", "Вторая", "2" ) ),
                stub( "B", book( "B", "Третья", "3" ) ) ) );

        List<ExternalBookResponse> found = service.search( "запрос", null, null, 10 );

        assertThat( found ).extracting( ExternalBookResponse::getTitle )
                           .containsExactly( "Первая", "Третья", "Вторая" );
    }

    /** Одна и та же книга приходит из обоих каталогов — по ISBN она сводится в одну строку. */
    @Test
    void mergesSameBookByIsbn() {
        ExternalMetadataService service = new ExternalMetadataService( List.of(
                stub( "A", book( "A", "Задача трёх тел", "978-5-17-104967-6" ) ),
                stub( "B", book( "B", "The Three-Body Problem", "9785171049676" ) ) ) );

        List<ExternalBookResponse> found = service.search( "три тела", null, null, 10 );

        assertThat( found ).hasSize( 1 );
        assertThat( found.get( 0 ).getProvider() ).isEqualTo( "A" );
    }

    @Test
    void usesOnlyRequestedProvider() {
        ExternalMetadataService service = new ExternalMetadataService( List.of(
                stub( "OPEN_LIBRARY", book( "OPEN_LIBRARY", "Первая", "1" ) ),
                stub( "GOOGLE_BOOKS", book( "GOOGLE_BOOKS", "Вторая", "2" ) ) ) );

        List<ExternalBookResponse> found = service.search( "запрос", null, "google_books", null );

        assertThat( found ).extracting( ExternalBookResponse::getProvider ).containsExactly( "GOOGLE_BOOKS" );
    }

    /** Без запроса и без ISBN идти в каталоги незачем. */
    @Test
    void returnsNothingWithoutQuery() {
        ExternalMetadataService service = new ExternalMetadataService( List.of(
                stub( "A", book( "A", "Первая", "1" ) ) ) );

        assertThat( service.search( "  ", null, null, null ) ).isEmpty();
    }

    private MetadataProvider stub( String name, ExternalBookResponse... books ) {
        return new MetadataProvider() {

            @Override
            public String name() {
                return name;
            }

            @Override
            public List<ExternalBookResponse> search( String query, String isbn, int limit ) {
                return List.of( books );
            }
        };
    }

    private ExternalBookResponse book( String provider, String title, String isbn ) {
        return ExternalBookResponse.builder().provider( provider ).title( title ).isbn( isbn ).build();
    }
}
