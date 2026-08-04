package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingSession;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Проверяет миграцию V11 против маппинга: проходы, заходы и выписки на настоящей PostgreSQL. */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class ReadingProgressIntegrationTest extends PostgresContainerTest {

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private ReadingLogRepository readingLogRepository;

    @Autowired
    private ReadingSessionRepository readingSessionRepository;

    @Autowired
    private QuoteRepository quoteRepository;

    @Test
    void storesProgressScaleAndDates() {
        LibraryItem item = new LibraryItem();
        item.setTitle( "Задача трёх тел" );
        // Статус «отложено» появился в этой же миграции и должен доезжать до БД.
        item.setStatus( ReadingStatus.ON_HOLD );
        item.setStartedAt( LocalDate.of( 2026, 1, 10 ) );
        item.setDeadline( LocalDate.of( 2026, 4, 1 ) );
        item.setProgressCurrent( 120 );
        item.setProgressTotal( 400 );
        item.setProgressUnit( ProgressUnit.PAGES );

        LibraryItem loaded = libraryItemRepository.findById( libraryItemRepository.saveAndFlush( item ).getId() )
                                                  .orElseThrow();

        assertThat( loaded.getStatus() ).isEqualTo( ReadingStatus.ON_HOLD );
        assertThat( loaded.getProgressUnit() ).isEqualTo( ProgressUnit.PAGES );
        assertThat( loaded.getProgressCurrent() ).isEqualTo( 120 );
        assertThat( loaded.getDeadline() ).isEqualTo( LocalDate.of( 2026, 4, 1 ) );
    }

    @Test
    void keepsAttemptsAndTheirSessionsApart() {
        LibraryItem item = libraryItemRepository.save( item( "Тёмный лес" ) );
        ReadingLog first = readingLogRepository.save( log( item, 1, LocalDate.of( 2025, 1, 1 ),
                                                           LocalDate.of( 2025, 2, 1 ) ) );
        ReadingLog second = readingLogRepository.save( log( item, 2, LocalDate.of( 2026, 3, 1 ), null ) );
        readingSessionRepository.save( session( item, first, LocalDate.of( 2025, 1, 5 ), 0, 100 ) );
        readingSessionRepository.save( session( item, second, LocalDate.of( 2026, 3, 2 ), 0, 40 ) );
        readingSessionRepository.flush();

        List<ReadingLog> logs = readingLogRepository.findByItemIdOrderByAttemptAsc( item.getId() );
        List<ReadingSession> sessions = readingSessionRepository
                .findByItemIdOrderBySessionDateDescCreatedAtDesc( item.getId() );

        assertThat( logs ).extracting( ReadingLog::getAttempt ).containsExactly( 1, 2 );
        // Свежий заход идёт первым: история читается сверху вниз.
        assertThat( sessions ).extracting( s -> s.getLog().getAttempt() ).containsExactly( 2, 1 );
    }

    /** Номер прохода уникален в пределах произведения — иначе история перечитываний поедет. */
    @Test
    void rejectsDuplicateAttemptNumber() {
        LibraryItem item = libraryItemRepository.save( item( "Вечная жизнь Смерти" ) );
        readingLogRepository.saveAndFlush( log( item, 1, LocalDate.of( 2026, 1, 1 ), null ) );

        assertThatThrownBy( () -> readingLogRepository.saveAndFlush( log( item, 1, LocalDate.of( 2026, 2, 1 ), null ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void searchesQuotesByTextIgnoringCase() {
        LibraryItem item = libraryItemRepository.save( item( "Задача трёх тел" ) );
        quoteRepository.save( quote( item, 42, "Не отвечайте! Не отвечайте! Не отвечайте!" ) );
        quoteRepository.save( quote( item, 7, "Слабость и невежество не помеха выживанию" ) );
        quoteRepository.flush();

        List<Quote> found = quoteRepository.search( "НЕВЕЖЕСТВО", null );

        assertThat( found ).singleElement().extracting( Quote::getPosition ).isEqualTo( 7 );
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setStatus( ReadingStatus.READING );
        return item;
    }

    private ReadingLog log( LibraryItem item, int attempt, LocalDate startedAt, LocalDate finishedAt ) {
        ReadingLog log = new ReadingLog();
        log.setItem( item );
        log.setAttempt( attempt );
        log.setStartedAt( startedAt );
        log.setFinishedAt( finishedAt );
        return log;
    }

    private ReadingSession session( LibraryItem item, ReadingLog log, LocalDate date, int from, int to ) {
        ReadingSession session = new ReadingSession();
        session.setItem( item );
        session.setLog( log );
        session.setSessionDate( date );
        session.setFromPosition( from );
        session.setToPosition( to );
        return session;
    }

    private Quote quote( LibraryItem item, int position, String text ) {
        Quote quote = new Quote();
        quote.setItem( item );
        quote.setPosition( position );
        quote.setText( text );
        return quote;
    }
}
