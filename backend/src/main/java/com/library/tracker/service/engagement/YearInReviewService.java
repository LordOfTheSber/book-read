package com.library.tracker.service.engagement;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.service.social.PublicReviewMapper;
import com.library.tracker.web.dto.AuthorSummary;
import com.library.tracker.web.dto.MonthCountResponse;
import com.library.tracker.web.dto.PublicReviewResponse;
import com.library.tracker.web.dto.TypeCountResponse;
import com.library.tracker.web.dto.YearInReviewResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * «Год в обзоре» — шеринговая карточка с итогами. Собирается из тех же срезов, что цель и стрик,
 * поэтому почти бесплатна: своих таблиц ей не нужно.
 * <p>
 * Считается на лету, а не сохраняется снимком: отчёт за незакончившийся год должен меняться вместе
 * с библиотекой, а за прошедший — исправляться, если запись задним числом поправили.
 */
@Service
@RequiredArgsConstructor
public class YearInReviewService {

    /** Столько лучших показывается в карточке: длиннее её уже никто не дочитывает. */
    private static final int TOP_LIMIT = 5;

    private final LibraryItemRepository libraryItemRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final PublicReviewMapper publicReviewMapper;
    private final StreakService streakService;
    private final UserService userService;
    private final Clock clock;

    @Transactional( readOnly = true )
    public YearInReviewResponse forYear( Integer year ) {
        UUID userId = userService.getCurrentUser().getId();
        int targetYear = year != null ? year : LocalDate.now( clock ).getYear();
        LocalDate from = LocalDate.of( targetYear, 1, 1 );
        LocalDate to = from.withDayOfYear( from.lengthOfYear() );

        List<LibraryItem> finished = libraryItemRepository.findFinishedBetween( userId, from, to );
        List<LocalDate> readingDates = readingSessionRepository.findReadingDates( userId, from, to );

        return YearInReviewResponse.builder()
                                   .year( targetYear )
                                   .finishedCount( finished.size() )
                                   .pageCount( finished.stream()
                                                       .filter( item -> item.getPageCount() != null )
                                                       .mapToLong( LibraryItem::getPageCount )
                                                       .sum() )
                                   .minuteCount( readingSessionRepository.sumMinutes( userId, from, to ) )
                                   .readingDays( readingDates.size() )
                                   .longestStreak( streakService.longestStreak( readingDates ) )
                                   .averageRating( averageRating( finished ) )
                                   .monthly( monthly( finished ) )
                                   .topRated( topRated( finished ) )
                                   .longestItem( longestItem( finished ) )
                                   .topAuthors( topAuthors( finished ) )
                                   .topTypes( topTypes( finished ) )
                                   .kindBreakdown( kindBreakdown( finished ) )
                                   .build();
    }

    /** Доли видов за год — по тем же записям, что уже загружены: отдельный запрос здесь не нужен. */
    private Map<MediaKind, Long> kindBreakdown( List<LibraryItem> finished ) {
        return finished.stream()
                       .filter( item -> item.getKind() != null )
                       .collect( Collectors.groupingBy( LibraryItem::getKind, Collectors.counting() ) );
    }

    private BigDecimal averageRating( List<LibraryItem> finished ) {
        List<BigDecimal> ratings = finished.stream()
                                           .map( LibraryItem::getRating )
                                           .filter( Objects::nonNull )
                                           .toList();
        if ( ratings.isEmpty() ) {
            return null;
        }
        BigDecimal sum = ratings.stream().reduce( BigDecimal.ZERO, BigDecimal::add );
        return sum.divide( BigDecimal.valueOf( ratings.size() ), 1, RoundingMode.HALF_UP );
    }

    /** Месяцы отдаются все двенадцать, включая пустые: провал в графике — тоже итог года. */
    private List<MonthCountResponse> monthly( List<LibraryItem> finished ) {
        Map<Integer, Long> counts = finished.stream()
                                            .collect( Collectors.groupingBy( item -> item.getFinishedAt()
                                                                                         .getMonthValue(),
                                                                             Collectors.counting() ) );
        return IntStream.rangeClosed( 1, 12 )
                        .mapToObj( month -> MonthCountResponse.builder()
                                                              .month( month )
                                                              .count( counts.getOrDefault( month, 0L ) )
                                                              .build() )
                        .toList();
    }

    private List<PublicReviewResponse> topRated( List<LibraryItem> finished ) {
        List<LibraryItem> top = finished.stream()
                                        .filter( item -> item.getRating() != null )
                                        .sorted( Comparator.comparing( LibraryItem::getRating ).reversed() )
                                        .limit( TOP_LIMIT )
                                        .toList();
        return publicReviewMapper.toResponses( top );
    }

    private PublicReviewResponse longestItem( List<LibraryItem> finished ) {
        return finished.stream()
                       .filter( item -> item.getPageCount() != null )
                       .max( Comparator.comparingInt( LibraryItem::getPageCount ) )
                       .map( item -> publicReviewMapper.toResponse( item, 0, 0 ) )
                       .orElse( null );
    }

    private List<AuthorSummary> topAuthors( List<LibraryItem> finished ) {
        Map<Author, Long> counts = new LinkedHashMap<>();
        finished.forEach( item -> item.getAuthors()
                                      .forEach( author -> counts.merge( author, 1L, Long::sum ) ) );
        return counts.entrySet().stream()
                     .sorted( Map.Entry.<Author, Long>comparingByValue().reversed() )
                     .limit( TOP_LIMIT )
                     .map( entry -> AuthorSummary.builder()
                                                 .id( entry.getKey().getId() )
                                                 .name( entry.getKey().getName() )
                                                 .altName( entry.getKey().getAltName() )
                                                 .build() )
                     .toList();
    }

    private List<TypeCountResponse> topTypes( List<LibraryItem> finished ) {
        Map<BookType, Long> counts = new LinkedHashMap<>();
        finished.stream()
                .filter( item -> item.getType() != null )
                .forEach( item -> counts.merge( item.getType(), 1L, Long::sum ) );
        return counts.entrySet().stream()
                     .sorted( Map.Entry.<BookType, Long>comparingByValue().reversed() )
                     .limit( TOP_LIMIT )
                     .map( entry -> TypeCountResponse.builder()
                                                     .typeId( entry.getKey().getId() )
                                                     .typeName( entry.getKey().getName() )
                                                     .count( entry.getValue() )
                                                     .build() )
                     .toList();
    }
}
