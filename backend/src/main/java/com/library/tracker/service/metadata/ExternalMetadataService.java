package com.library.tracker.service.metadata;

import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Поиск по внешним каталогам — самая окупаемая функция раздела 5: вручную библиотеку никто
 * заполнять не станет, а из находки карточка собирается одним нажатием.
 * <p>
 * Каталоги опрашиваются оба и выдача перемежается: у Open Library лучше с изданиями и обложками,
 * у Google Books — со свежим и нерусским, и первая десятка любого из них по отдельности неполна.
 */
@Service
@RequiredArgsConstructor
public class ExternalMetadataService {

    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 25;

    private final List<MetadataProvider> providers;

    public List<ExternalBookResponse> search( String query, String isbn, String provider, Integer limit ) {
        String normalizedIsbn = normalizeIsbn( isbn );
        String normalizedQuery = StringUtils.hasText( query ) ? query.trim() : null;
        if ( normalizedIsbn == null && normalizedQuery == null ) {
            return List.of();
        }

        int size = limit == null ? DEFAULT_LIMIT : Math.min( Math.max( limit, 1 ), MAX_LIMIT );
        List<List<ExternalBookResponse>> results = providers.stream()
                                                            .filter( p -> provider == null
                                                                          || p.name().equalsIgnoreCase( provider ) )
                                                            .map( p -> p.search( normalizedQuery, normalizedIsbn,
                                                                                 size ) )
                                                            .toList();

        return dedupe( interleave( results ), size );
    }

    /** По одной находке от каждого каталога по кругу: иначе первый вытеснит второй целиком. */
    private List<ExternalBookResponse> interleave( List<List<ExternalBookResponse>> results ) {
        List<ExternalBookResponse> merged = new ArrayList<>();
        int longest = results.stream().mapToInt( List::size ).max().orElse( 0 );
        for ( int index = 0; index < longest; index++ ) {
            for ( List<ExternalBookResponse> result : results ) {
                if ( index < result.size() ) {
                    merged.add( result.get( index ) );
                }
            }
        }
        return merged;
    }

    /**
     * Одна и та же книга приходит из обоих каталогов. Сводятся по ISBN, а без него — по названию
     * с первым автором: этого хватает, чтобы не показывать один том дважды подряд.
     */
    private List<ExternalBookResponse> dedupe( List<ExternalBookResponse> found, int limit ) {
        Set<String> seen = new LinkedHashSet<>();
        List<ExternalBookResponse> unique = new ArrayList<>();
        for ( ExternalBookResponse book : found ) {
            if ( unique.size() >= limit ) {
                break;
            }
            if ( seen.add( fingerprint( book ) ) ) {
                unique.add( book );
            }
        }
        return unique;
    }

    private String fingerprint( ExternalBookResponse book ) {
        String isbn = normalizeIsbn( book.getIsbn() );
        if ( isbn != null ) {
            return "isbn:" + isbn;
        }
        String author = book.getAuthorNames() == null || book.getAuthorNames().isEmpty()
                ? ""
                : book.getAuthorNames().get( 0 );
        return ( book.getTitle() + "|" + author ).toLowerCase( Locale.ROOT );
    }

    private String normalizeIsbn( String isbn ) {
        if ( !StringUtils.hasText( isbn ) ) {
            return null;
        }
        String normalized = isbn.replaceAll( "[^0-9Xx]", "" );
        return normalized.isEmpty() ? null : normalized;
    }
}
