package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.DuplicateCandidateResponse;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Детектор дублей при добавлении. Одна и та же книга приезжает в библиотеку трижды: руками,
 * из каталога и из импорта, — и без проверки библиотека расходится копиями.
 * <p>
 * Совпадение не блокирует ввод: решает всё равно пользователь, потому что второе издание,
 * перевод и подарочный экземпляр — законные поводы завести вторую запись.
 */
@Service
@RequiredArgsConstructor
public class DuplicateDetectionService {

    /** Больше десятка кандидатов — это уже не подсказка, а другой список. */
    private static final int MAX_CANDIDATES = 10;

    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<DuplicateCandidateResponse> findDuplicates( String isbn, String title ) {
        return findDuplicates( isbn, title, userService.getCurrentUser() );
    }

    /**
     * Ищет в библиотеке пользователя. Даже администратору чужие совпадения не показываются:
     * подсказка «такое уже есть» про чужую библиотеку бессмысленна.
     */
    @Transactional( readOnly = true )
    public List<DuplicateCandidateResponse> findDuplicates( String isbn, String title, User owner ) {
        // Порядок важен: совпадение по ISBN сильнее совпадения по названию, и при пересечении
        // должна остаться сильная причина.
        Map<UUID, DuplicateCandidateResponse> found = new LinkedHashMap<>();

        String normalizedIsbn = normalizeIsbn( isbn );
        if ( normalizedIsbn != null ) {
            for ( LibraryItem item : libraryItemRepository.findByNormalizedIsbn( normalizedIsbn, owner.getId() ) ) {
                found.put( item.getId(),
                           toCandidate( item, DuplicateCandidateResponse.MatchReason.ISBN ) );
            }
        }

        if ( StringUtils.hasText( title ) ) {
            for ( LibraryItem item : libraryItemRepository.findSimilarByTitle( title.trim(), owner.getId() ) ) {
                found.putIfAbsent( item.getId(),
                                   toCandidate( item, DuplicateCandidateResponse.MatchReason.TITLE ) );
            }
        }

        return new ArrayList<>( found.values() ).subList( 0, Math.min( found.size(), MAX_CANDIDATES ) );
    }

    /** ISBN печатают с дефисами и пробелами как попало — сравнивать имеет смысл только цифры. */
    public static String normalizeIsbn( String isbn ) {
        if ( !StringUtils.hasText( isbn ) ) {
            return null;
        }
        String normalized = isbn.replace( "-", "" ).replace( " ", "" ).trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private DuplicateCandidateResponse toCandidate( LibraryItem item,
                                                    DuplicateCandidateResponse.MatchReason reason ) {
        return DuplicateCandidateResponse.builder()
                                         .id( item.getId() )
                                         .title( item.getTitle() )
                                         .authorNames( item.getAuthors().stream()
                                                           .map( Author::getName )
                                                           .sorted( String.CASE_INSENSITIVE_ORDER )
                                                           .toList() )
                                         .isbn( item.getIsbn() )
                                         .publishedYear( item.getPublishedYear() )
                                         .hasCover( item.getCoverKey() != null )
                                         .reason( reason )
                                         .build();
    }
}
