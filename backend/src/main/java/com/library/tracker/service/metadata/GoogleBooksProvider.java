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
public class GoogleBooksProvider implements MetadataProvider {

    public static final String NAME = "GOOGLE_BOOKS";

    private final RestClient restClient;
    private final String baseUrl;

    public GoogleBooksProvider( RestClient.Builder builder,
                                @Value( "${metadata.google-books.url:https://www.googleapis.com/books/v1}" )
                                String baseUrl ) {
        this.restClient = builder.build();
        this.baseUrl = baseUrl;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public List<ExternalBookResponse> search( String query, String isbn, int limit ) {
        String expression = isbn != null ? "isbn:" + isbn : query;
        String uri = UriComponentsBuilder.fromUriString( baseUrl )
                                         .path( "/volumes" )
                                         .queryParam( "q", expression )
                                         .queryParam( "maxResults", Math.min( limit, 40 ) )
                                         .build()
                                         .toUriString();

        try {
            return parse( restClient.get().uri( uri ).retrieve().body( JsonNode.class ), limit );
        } catch ( Exception ex ) {
            log.warn( "Google Books не ответил на поиск: {}", ex.getMessage() );
            return List.of();
        }
    }

    private List<ExternalBookResponse> parse( JsonNode body, int limit ) {
        if ( body == null || !body.path( "items" ).isArray() ) {
            return List.of();
        }
        List<ExternalBookResponse> found = new ArrayList<>();
        for ( JsonNode item : body.path( "items" ) ) {
            if ( found.size() >= limit ) {
                break;
            }
            JsonNode info = item.path( "volumeInfo" );
            String title = text( info.path( "title" ) );
            if ( title == null ) {
                continue;
            }
            found.add( ExternalBookResponse.builder()
                                           .provider( NAME )
                                           .externalId( text( item.path( "id" ) ) )
                                           .title( title )
                                           .altTitle( text( info.path( "subtitle" ) ) )
                                           .authorNames( strings( info.path( "authors" ) ) )
                                           .isbn( isbn( info.path( "industryIdentifiers" ) ) )
                                           .publishedYear( year( text( info.path( "publishedDate" ) ) ) )
                                           .language( text( info.path( "language" ) ) )
                                           .pageCount( integer( info.path( "pageCount" ) ) )
                                           .publisher( text( info.path( "publisher" ) ) )
                                           .description( text( info.path( "description" ) ) )
                                           .coverUrl( coverUrl( info.path( "imageLinks" ) ) )
                                           .build() );
        }
        return found;
    }

    /** ISBN-13 предпочтительнее: он уникален, а десятизначный встречается у двух изданий сразу. */
    private String isbn( JsonNode identifiers ) {
        if ( !identifiers.isArray() ) {
            return null;
        }
        String fallback = null;
        for ( JsonNode identifier : identifiers ) {
            String type = text( identifier.path( "type" ) );
            String value = text( identifier.path( "identifier" ) );
            if ( value == null ) {
                continue;
            }
            if ( "ISBN_13".equals( type ) ) {
                return value;
            }
            if ( "ISBN_10".equals( type ) && fallback == null ) {
                fallback = value;
            }
        }
        return fallback;
    }

    /** Дата издания приходит то годом, то «2006-05», то полной датой. */
    private Integer year( String publishedDate ) {
        if ( publishedDate == null || publishedDate.length() < 4 ) {
            return null;
        }
        try {
            return Integer.parseInt( publishedDate.substring( 0, 4 ) );
        } catch ( NumberFormatException ex ) {
            return null;
        }
    }

    /** Ссылки на обложки приходят по http — браузер на https-странице их не покажет. */
    private String coverUrl( JsonNode imageLinks ) {
        String thumbnail = text( imageLinks.path( "thumbnail" ) );
        if ( thumbnail == null ) {
            thumbnail = text( imageLinks.path( "smallThumbnail" ) );
        }
        return thumbnail != null ? thumbnail.replaceFirst( "^http://", "https://" ) : null;
    }

    private static String text( JsonNode node ) {
        return node.isTextual() && !node.asText().isBlank() ? node.asText() : null;
    }

    private static Integer integer( JsonNode node ) {
        return node.isNumber() && node.asInt() > 0 ? node.asInt() : null;
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
}
