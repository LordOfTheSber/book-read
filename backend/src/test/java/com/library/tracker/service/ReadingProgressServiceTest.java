package com.library.tracker.service;

import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.web.dto.ProgressResponse;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ReadingProgressServiceTest {

    private static final LocalDate TODAY = LocalDate.of( 2026, 3, 15 );

    @Mock
    private ReadingSessionRepository readingSessionRepository;

    @Mock
    private ReadingLogRepository readingLogRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private LibraryItemAccess itemAccess;

    private ReadingProgressService service;

    @BeforeEach
    void setUp() {
        service = new ReadingProgressService( readingSessionRepository, readingLogRepository, libraryItemRepository,
                                              itemAccess );
    }

    @Test
    void startingToReadSetsStartDateAndOpensFirstAttempt() {
        LibraryItem item = item( ReadingStatus.READING );
        when( readingLogRepository.findFirstByItemIdOrderByAttemptDesc( eq( item.getId() ) ) )
                .thenReturn( Optional.empty() );
        when( readingLogRepository.save( any( ReadingLog.class ) ) ).thenAnswer( inv -> inv.getArgument( 0 ) );

        service.applyStatusTransition( item, ReadingStatus.PLANNED, TODAY );

        assertThat( item.getStartedAt() ).isEqualTo( TODAY );
        ArgumentCaptor<ReadingLog> log = ArgumentCaptor.forClass( ReadingLog.class );
        verify( readingLogRepository ).save( log.capture() );
        assertThat( log.getValue().getAttempt() ).isEqualTo( 1 );
    }

    @Test
    void completingClosesAttemptAndFillsFinishDate() {
        LibraryItem item = item( ReadingStatus.COMPLETED );
        item.setStartedAt( LocalDate.of( 2026, 3, 1 ) );
        item.setProgressTotal( 400 );
        ReadingLog open = log( item, 1, LocalDate.of( 2026, 3, 1 ), null );
        when( readingLogRepository.findFirstByItemIdOrderByAttemptDesc( eq( item.getId() ) ) )
                .thenReturn( Optional.of( open ) );
        when( readingLogRepository.save( any( ReadingLog.class ) ) ).thenAnswer( inv -> inv.getArgument( 0 ) );

        service.applyStatusTransition( item, ReadingStatus.READING, TODAY );

        assertThat( item.getFinishedAt() ).isEqualTo( TODAY );
        // Дочитанное произведение стоит на конце шкалы, иначе полоса застыла бы на 90%.
        assertThat( item.getProgressCurrent() ).isEqualTo( 400 );
        assertThat( open.getFinishedAt() ).isEqualTo( TODAY );
    }

    /** Перечитывание — это новый проход, а не перезапись единственного статуса. */
    @Test
    void returningToReadingAfterCompletionOpensNextAttempt() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setStartedAt( LocalDate.of( 2025, 1, 1 ) );
        item.setFinishedAt( LocalDate.of( 2025, 2, 1 ) );
        item.setProgressCurrent( 400 );
        when( readingLogRepository.findFirstByItemIdOrderByAttemptDesc( eq( item.getId() ) ) )
                .thenReturn( Optional.of( log( item, 1, LocalDate.of( 2025, 1, 1 ), LocalDate.of( 2025, 2, 1 ) ) ) );
        when( readingLogRepository.save( any( ReadingLog.class ) ) ).thenAnswer( inv -> inv.getArgument( 0 ) );

        service.applyStatusTransition( item, ReadingStatus.COMPLETED, TODAY );

        assertThat( item.getStartedAt() ).isEqualTo( TODAY );
        assertThat( item.getFinishedAt() ).isNull();
        assertThat( item.getProgressCurrent() ).isZero();
        ArgumentCaptor<ReadingLog> log = ArgumentCaptor.forClass( ReadingLog.class );
        verify( readingLogRepository ).save( log.capture() );
        assertThat( log.getValue().getAttempt() ).isEqualTo( 2 );
    }

    /** Отложенное продолжают тем же проходом: новая попытка тут ни при чём. */
    @Test
    void resumingFromHoldKeepsTheSameAttemptAndStartDate() {
        LibraryItem item = item( ReadingStatus.READING );
        LocalDate started = LocalDate.of( 2026, 1, 10 );
        item.setStartedAt( started );
        when( readingLogRepository.findFirstByItemIdOrderByAttemptDesc( eq( item.getId() ) ) )
                .thenReturn( Optional.of( log( item, 1, started, null ) ) );

        service.applyStatusTransition( item, ReadingStatus.ON_HOLD, TODAY );

        assertThat( item.getStartedAt() ).isEqualTo( started );
        verify( readingLogRepository, never() ).save( any( ReadingLog.class ) );
    }

    @Test
    void unchangedStatusChangesNothing() {
        LibraryItem item = item( ReadingStatus.READING );

        service.applyStatusTransition( item, ReadingStatus.READING, TODAY );

        assertThat( item.getStartedAt() ).isNull();
        verify( readingLogRepository, never() ).save( any( ReadingLog.class ) );
    }

    @Test
    void progressReportsPercentAndRemaining() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setProgressTotal( 400 );
        item.setProgressCurrent( 100 );

        ProgressResponse progress = service.toProgress( item, TODAY );

        assertThat( progress.getPercent() ).isEqualTo( 25 );
        assertThat( progress.getRemaining() ).isEqualTo( 300 );
        assertThat( progress.getUnit() ).isEqualTo( ProgressUnit.PAGES );
    }

    /** Норма в день округляется вверх: «100 страниц за 3 дня» — это 34, а не 33. */
    @Test
    void dailyNormRoundsUp() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setProgressTotal( 400 );
        item.setProgressCurrent( 300 );
        item.setDeadline( TODAY.plusDays( 3 ) );

        ProgressResponse progress = service.toProgress( item, TODAY );

        assertThat( progress.getDailyNorm() ).isEqualTo( 34 );
        assertThat( progress.getDaysLeft() ).isEqualTo( 3 );
    }

    @Test
    void marksBehindScheduleWhenPaceIsBelowEvenSplit() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setProgressTotal( 400 );
        item.setProgressCurrent( 10 );
        item.setStartedAt( TODAY.minusDays( 9 ) );
        item.setDeadline( TODAY.plusDays( 1 ) );

        assertThat( service.toProgress( item, TODAY ).isBehindSchedule() ).isTrue();
    }

    @Test
    void keepsScheduleWhenPaceIsAhead() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setProgressTotal( 400 );
        item.setProgressCurrent( 390 );
        item.setStartedAt( TODAY.minusDays( 9 ) );
        item.setDeadline( TODAY.plusDays( 1 ) );

        assertThat( service.toProgress( item, TODAY ).isBehindSchedule() ).isFalse();
    }

    /** Шкала не задана — полосу рисовать не из чего, но единица всё равно нужна подписи. */
    @Test
    void progressWithoutScaleReportsOnlyUnit() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setFormat( ItemFormat.AUDIO );

        ProgressResponse progress = service.toProgress( item, TODAY );

        assertThat( progress.getPercent() ).isNull();
        assertThat( progress.getUnit() ).isEqualTo( ProgressUnit.MINUTES );
    }

    /** Без своей шкалы у книги берётся число страниц издания. */
    @Test
    void progressFallsBackToPageCount() {
        LibraryItem item = item( ReadingStatus.READING );
        item.setPageCount( 200 );
        item.setProgressCurrent( 50 );

        assertThat( service.toProgress( item, TODAY ).getPercent() ).isEqualTo( 25 );
    }

    private LibraryItem item( ReadingStatus status ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Задача трёх тел" );
        item.setStatus( status );
        return item;
    }

    private ReadingLog log( LibraryItem item, int attempt, LocalDate startedAt, LocalDate finishedAt ) {
        ReadingLog log = new ReadingLog();
        log.setId( UUID.randomUUID() );
        log.setItem( item );
        log.setAttempt( attempt );
        log.setStartedAt( startedAt );
        log.setFinishedAt( finishedAt );
        return log;
    }
}
