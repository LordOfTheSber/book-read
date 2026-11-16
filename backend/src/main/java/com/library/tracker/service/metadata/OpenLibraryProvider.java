package com.library.tracker.service.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.ArrayList;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Component
public class OpenLibraryProvider implements MetadataProvider {

    public static final String NAME = "OPEN_LIBRARY";

    /** Поля перечислены явно: ответ по умолчанию тащит десятки килобайт на находку. */
    private static final String FIELDS =
            "key,title,subtitle,author_name,first_publish_year,isbn,language,number_of_pages_median,publisher,cover_i";

    private final RestClient restClient;
    private final String baseUrl;
    private final String coversUrl;

    public OpenLibraryProvider( RestClient.Builder builder,
                                @Value( "${metadata.open-library.url:https://openlibrary.org}" ) String baseUrl,
                                @Value( "${metadata.open-library.covers-url:https://covers.openlibrary.org}" )
                                String coversUrl ) {
        this.restClient = builder.build();
        this.baseUrl = baseUrl;
        this.coversUrl = coversUrl;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public List<ExternalBookResponse> search( String query, String isbn, int limit ) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString( baseUrl )
                                                       .path( "/search.json" )
                                                       .queryParam( "fields", FIELDS )
                                                       .queryParam( "limit", limit );
        if ( isbn != null ) {
            uri.queryParam( "isbn", isbn );
        } else {
            uri.queryParam( "q", query );
        }

        try {
            JsonNode body = restClient.get()
                                      .uri( uri.build().toUriString() )
                                      .retrieve()
                                      .body( JsonNode.class );
            return parse( body, limit );
        } catch ( Exception ex ) {
            // Чужой сервис лежит — это не ошибка нашего запроса: вторая половина выдачи придёт
            // от другого каталога, а пустая выдача честнее пятисотки.
            log.warn( "Open Library не ответил на поиск: {}", ex.getMessage() );
            return List.of();
        }
    }

    private List<ExternalBookResponse> parse( JsonNode body, int limit ) {
        if ( body == null || !body.path( "docs" ).isArray() ) {
            return List.of();
        }
        List<ExternalBookResponse> found = new ArrayList<>();
        for ( JsonNode doc : body.path( "docs" ) ) {
            if ( found.size() >= limit ) {
                break;
            }
            String title = text( doc.path( "title" ) );
            if ( title == null ) {
                continue;
            }
            found.add( ExternalBookResponse.builder()
                                           .provider( NAME )
                                           .externalId( text( doc.path( "key" ) ) )
                                           .title( title )
                                           .altTitle( text( doc.path( "subtitle" ) ) )
                                           .authorNames( strings( doc.path( "author_name" ) ) )
                                           .isbn( firstString( doc.path( "isbn" ) ) )
                                           .publishedYear( integer( doc.path( "first_publish_year" ) ) )
                                           .language( firstString( doc.path( "language" ) ) )
                                           .pageCount( integer( doc.path( "number_of_pages_median" ) ) )
                                           .publisher( firstString( doc.path( "publisher" ) ) )
                                           .coverUrl( coverUrl( doc.path( "cover_i" ) ) )
                                           .build() );
        }
        return found;
    }

    private String coverUrl( JsonNode coverId ) {
        return coverId.isNumber() ? coversUrl + "/b/id/" + coverId.asInt() + "-L.jpg" : null;
    }

    private static String text( JsonNode node ) {
        return node.isTextual() && !node.asText().isBlank() ? node.asText() : null;
    }

    private static Integer integer( JsonNode node ) {
        return node.isNumber() ? node.asInt() : null;
    }

    private static List<String> strings( JsonNode node ) {
        if ( !node.isArray() ) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.forEach( element -> {
            String value = text( element );
            if ( value != null ) {
                values.add( value );
            }
        } );
        return values;
    }

    private static String firstString( JsonNode node ) {
        List<String> values = strings( node );
        return values.isEmpty() ? null : values.get( 0 );
    }
}
