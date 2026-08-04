package com.library.tracker.service;

import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingSession;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.web.dto.ProgressResponse;
import com.library.tracker.web.dto.ReadingLogResponse;
import com.library.tracker.web.dto.ReadingSessionRequest;
import com.library.tracker.web.dto.ReadingSessionResponse;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Время и прогресс: когда произведение начато и закончено, сколько проходов было и на чём
 * остановились. Раньше статус переключался мгновенно и бесследно.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ReadingProgressService {

    private final ReadingSessionRepository readingSessionRepository;
    private final ReadingLogRepository readingLogRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final LibraryItemAccess itemAccess;

    /**
     * Приводит даты и проходы в соответствие новому статусу. Вызывается после применения запроса,
     * когда ещё известен прежний статус.
     */
    public void applyStatusTransition( LibraryItem item, ReadingStatus previous, LocalDate today ) {
        ReadingStatus current = item.getStatus();
        if ( current == previous ) {
            return;
        }

        if ( current == ReadingStatus.READING ) {
            startAttempt( item, previous, today );
        } else if ( current == ReadingStatus.COMPLETED ) {
            finishAttempt( item, today );
        }
    }

    /**
     * Начало чтения. Возврат к чтению уже завершённого — это перечитывание: открывается новый
     * проход, а прогресс отсчитывается заново.
     */
    private void startAttempt( LibraryItem item, ReadingStatus previous, LocalDate today ) {
        if ( previous == ReadingStatus.COMPLETED ) {
            item.setFinishedAt( null );
            item.setStartedAt( today );
            item.setProgressCurrent( 0 );
            openLog( item, today );
            return;
        }
        if ( item.getStartedAt() == null ) {
            item.setStartedAt( today );
        }
        // Отложенное или бро́шенное произведение продолжают тем же проходом.
        if ( currentLog( item ).isEmpty() ) {
            openLog( item, today );
        }
    }

    private void finishAttempt( LibraryItem item, LocalDate today ) {
        if ( item.getFinishedAt() == null ) {
            item.setFinishedAt( today );
        }
        if ( item.getStartedAt() == null ) {
            // Книгу могли отметить прочитанной, минуя статус «читаю».
            item.setStartedAt( today );
        }
        if ( item.getProgressTotal() != null ) {
            item.setProgressCurrent( item.getProgressTotal() );
        }

        ReadingLog log = currentLog( item ).orElseGet( () -> openLog( item, item.getStartedAt() ) );
        log.setFinishedAt( item.getFinishedAt() );
        if ( log.getStartedAt() == null ) {
            log.setStartedAt( item.getStartedAt() );
        }
        // Оценка снимается с карточки в момент завершения: при перечитывании она обычно другая,
        // и старая должна остаться в своём проходе.
        log.setRating( item.getRating() );
        log.setRatingPlot( item.getRatingPlot() );
        log.setRatingStyle( item.getRatingStyle() );
        log.setRatingCharacters( item.getRatingCharacters() );
        log.setRatingEnding( item.getRatingEnding() );
        log.setComment( item.getReview() );
        readingLogRepository.save( log );
    }

    private ReadingLog openLog( LibraryItem item, LocalDate startedAt ) {
        int nextAttempt = readingLogRepository.findFirstByItemIdOrderByAttemptDesc( item.getId() )
                                              .map( log -> log.getAttempt() + 1 )
                                              .orElse( 1 );
        ReadingLog log = new ReadingLog();
        log.setItem( item );
        log.setAttempt( nextAttempt );
        log.setStartedAt( startedAt );
        return readingLogRepository.save( log );
    }

    /** Текущий проход — последний по номеру и ещё не закрытый. */
    private Optional<ReadingLog> currentLog( LibraryItem item ) {
        return readingLogRepository.findFirstByItemIdOrderByAttemptDesc( item.getId() )
                                   .filter( log -> log.getFinishedAt() == null );
    }

    @Transactional( readOnly = true )
    public List<ReadingSessionResponse> listSessions( UUID itemId ) {
        itemAccess.requireReadable( itemId );
        return readingSessionRepository.findByItemIdOrderBySessionDateDescCreatedAtDesc( itemId ).stream()
                                       .map( this::toResponse )
                                       .toList();
    }

    /**
     * Записывает заход и двигает прогресс. Быстрое «+10 страниц» на карточке — это тот же вызов
     * с {@code fromPosition} на текущей позиции.
     */
    public ReadingSessionResponse addSession( UUID itemId, ReadingSessionRequest request, LocalDate today ) {
        LibraryItem item = itemAccess.requireWritable( itemId, "Вы можете отмечать прогресс только своих книг" );

        if ( request.getFromPosition() != null && request.getToPosition() != null
             && request.getToPosition() < request.getFromPosition() )
        {
            throw new IllegalArgumentException( "Конечная позиция не может быть меньше начальной" );
        }

        ReadingSession session = new ReadingSession();
        session.setItem( item );
        session.setSessionDate( request.getSessionDate() != null ? request.getSessionDate() : today );
        session.setFromPosition( request.getFromPosition() );
        session.setToPosition( request.getToPosition() );
        session.setDurationMinutes( request.getDurationMinutes() );
        session.setNote( request.getNote() );
        currentLog( item ).ifPresent( session::setLog );

        ReadingSession saved = readingSessionRepository.save( session );
        advanceProgress( item, request.getToPosition() );
        return toResponse( saved );
    }

    public void deleteSession( UUID itemId, UUID sessionId ) {
        itemAccess.requireWritable( itemId, "Вы можете править прогресс только своих книг" );
        readingSessionRepository.findById( sessionId )
                                .filter( session -> session.getItem().getId().equals( itemId ) )
                                .ifPresent( readingSessionRepository::delete );
    }

    @Transactional( readOnly = true )
    public List<ReadingLogResponse> listLogs( UUID itemId ) {
        itemAccess.requireReadable( itemId );

        Map<UUID, Long> sessionsByLog =
                readingSessionRepository.findByItemIdOrderBySessionDateDescCreatedAtDesc( itemId ).stream()
                                        .filter( session -> session.getLog() != null )
                                        .collect( Collectors.groupingBy( session -> session.getLog().getId(),
                                                                         Collectors.counting() ) );

        return readingLogRepository.findByItemIdOrderByAttemptAsc( itemId ).stream()
                                   .map( log -> toResponse( log, sessionsByLog.getOrDefault( log.getId(), 0L ) ) )
                                   .toList();
    }

    /** Прогресс не должен ехать назад от старого захода и вылезать за верх шкалы. */
    private void advanceProgress( LibraryItem item, Integer toPosition ) {
        if ( toPosition == null ) {
            return;
        }
        int capped = item.getProgressTotal() != null ? Math.min( toPosition, item.getProgressTotal() ) : toPosition;
        if ( item.getProgressCurrent() == null || capped > item.getProgressCurrent() ) {
            item.setProgressCurrent( capped );
            libraryItemRepository.save( item );
        }
    }

    /**
     * Считает всё, что выводится рядом с полосой прогресса. Норма в день округляется вверх:
     * «осталось 100 страниц за 3 дня» — это 34 в день, а не 33.
     */
    public ProgressResponse toProgress( LibraryItem item, LocalDate today ) {
        Integer total = resolveTotal( item );
        Integer current = item.getProgressCurrent();
        ProgressUnit unit = resolveUnit( item );

        if ( total == null || total <= 0 ) {
            return ProgressResponse.builder().current( current ).unit( unit ).build();
        }

        int done = current != null ? Math.min( current, total ) : 0;
        int remaining = total - done;
        int percent = (int) Math.round( done * 100.0 / total );

        Integer daysLeft = null;
        Integer dailyNorm = null;
        boolean behind = false;
        if ( item.getDeadline() != null && remaining > 0 ) {
            long days = ChronoUnit.DAYS.between( today, item.getDeadline() );
            daysLeft = (int) days;
            if ( days > 0 ) {
                dailyNorm = (int) Math.ceil( remaining / (double) days );
            } else {
                // Срок сегодня или уже прошёл: успеть можно только закрыв весь остаток.
                dailyNorm = remaining;
                behind = true;
            }
            behind = behind || isBehindSchedule( item, today, total, done );
        }

        return ProgressResponse.builder()
                               .current( done )
                               .total( total )
                               .unit( unit )
                               .percent( percent )
                               .remaining( remaining )
                               .daysLeft( daysLeft )
                               .dailyNorm( dailyNorm )
                               .behindSchedule( behind )
                               .build();
    }

    /**
     * Отставание считается от равномерного графика: если бы читали ровно с первого дня по норме,
     * сколько было бы пройдено к сегодняшнему дню.
     */
    private boolean isBehindSchedule( LibraryItem item, LocalDate today, int total, int done ) {
        LocalDate start = item.getStartedAt();
        if ( start == null || !start.isBefore( item.getDeadline() ) ) {
            return false;
        }
        long wholeSpan = ChronoUnit.DAYS.between( start, item.getDeadline() );
        long elapsed = Math.max( 0, ChronoUnit.DAYS.between( start, today ) );
        if ( wholeSpan <= 0 ) {
            return false;
        }
        double expected = total * Math.min( 1.0, elapsed / (double) wholeSpan );
        return done < Math.floor( expected );
    }

    /**
     * Если шкала не задана, берём число страниц издания — но только там, где прогресс и правда
     * измеряется страницами. У аудиокниги и сериала число страниц ничего не значит.
     */
    private Integer resolveTotal( LibraryItem item ) {
        if ( item.getProgressTotal() != null ) {
            return item.getProgressTotal();
        }
        return resolveUnit( item ) == ProgressUnit.PAGES ? item.getPageCount() : null;
    }

    /**
     * Единица прогресса: своя из карточки, иначе по формату экземпляра (аудио — минуты),
     * иначе по виду произведения — у манги тома, у сериала эпизоды.
     */
    private ProgressUnit resolveUnit( LibraryItem item ) {
        if ( item.getProgressUnit() != null ) {
            return item.getProgressUnit();
        }
        if ( item.getFormat() == ItemFormat.AUDIO ) {
            return ProgressUnit.MINUTES;
        }
        return item.getKind() != null ? item.getKind().defaultProgressUnit() : ProgressUnit.PAGES;
    }

    private ReadingSessionResponse toResponse( ReadingSession session ) {
        return ReadingSessionResponse.builder()
                                     .id( session.getId() )
                                     .itemId( session.getItem().getId() )
                                     .logId( session.getLog() != null ? session.getLog().getId() : null )
                                     .sessionDate( session.getSessionDate() )
                                     .fromPosition( session.getFromPosition() )
                                     .toPosition( session.getToPosition() )
                                     .durationMinutes( session.getDurationMinutes() )
                                     .note( session.getNote() )
                                     .build();
    }

    private ReadingLogResponse toResponse( ReadingLog log, long sessionCount ) {
        Long durationDays = log.getStartedAt() != null && log.getFinishedAt() != null
                ? ChronoUnit.DAYS.between( log.getStartedAt(), log.getFinishedAt() )
                : null;
        return ReadingLogResponse.builder()
                                 .id( log.getId() )
                                 .attempt( log.getAttempt() )
                                 .startedAt( log.getStartedAt() )
                                 .finishedAt( log.getFinishedAt() )
                                 .rating( log.getRating() )
                                 .ratingPlot( log.getRatingPlot() )
                                 .ratingStyle( log.getRatingStyle() )
                                 .ratingCharacters( log.getRatingCharacters() )
                                 .ratingEnding( log.getRatingEnding() )
                                 .comment( log.getComment() )
                                 .sessionCount( sessionCount )
                                 .durationDays( durationDays )
                                 .build();
    }
}
