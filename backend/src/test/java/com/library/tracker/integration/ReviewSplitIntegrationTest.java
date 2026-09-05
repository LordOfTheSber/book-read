package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingLogRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** Проверяет миграцию V13 против маппинга: раздельные заметка и отзыв, критерии и их история. */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class ReviewSplitIntegrationTest extends PostgresContainerTest {

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private ReadingLogRepository readingLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** Прежнее поле comment должно исчезнуть: иначе половина кода писала бы не туда. */
    @Test
    void dropsTheOldCommentColumn() {
        List<String> columns = jdbcTemplate.queryForList(
                "select column_name from information_schema.columns where table_name = 'library_items'",
                String.class );

        assertThat( columns ).contains( "note", "review", "review_spoiler", "rating_plot" )
                             .doesNotContain( "comment" );
    }

    @Test
    void keepsNoteAndReviewApart() {
        LibraryItem item = new LibraryItem();
        item.setTitle( "Задача трёх тел" );
        item.setStatus( ReadingStatus.COMPLETED );
        item.setNote( "Купить второй том" );
        item.setReview( "Лучшая твёрдая фантастика за десятилетие" );
        item.setReviewSpoiler( "Развязка с софоном оправдывает всё" );
        item.setRating( new BigDecimal( "9.0" ) );
        item.setRatingPlot( new BigDecimal( "9.5" ) );
        item.setRatingCharacters( new BigDecimal( "7.0" ) );

        LibraryItem loaded = libraryItemRepository.findById( libraryItemRepository.saveAndFlush( item ).getId() )
                                                  .orElseThrow();

        assertThat( loaded.getNote() ).isEqualTo( "Купить второй том" );
        assertThat( loaded.getReview() ).isEqualTo( "Лучшая твёрдая фантастика за десятилетие" );
        assertThat( loaded.getReviewSpoiler() ).isEqualTo( "Развязка с софоном оправдывает всё" );
        assertThat( loaded.getRatingPlot() ).isEqualByComparingTo( "9.5" );
        assertThat( loaded.getRatingCharacters() ).isEqualByComparingTo( "7.0" );
    }

    /** Смысл истории оценок в том, что у разных проходов они разные. */
    @Test
    void storesDifferentRatingsPerAttempt() {
        LibraryItem item = libraryItemRepository.save( item( "Тёмный лес" ) );
        readingLogRepository.save( log( item, 1, new BigDecimal( "7.0" ) ) );
        readingLogRepository.save( log( item, 2, new BigDecimal( "9.5" ) ) );
        readingLogRepository.flush();

        List<ReadingLog> logs = readingLogRepository.findByItemIdOrderByAttemptAsc( item.getId() );

        assertThat( logs ).extracting( ReadingLog::getRating )
                          .containsExactly( new BigDecimal( "7.0" ), new BigDecimal( "9.5" ) );
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setStatus( ReadingStatus.COMPLETED );
        return item;
    }

    private ReadingLog log( LibraryItem item, int attempt, BigDecimal rating ) {
        ReadingLog log = new ReadingLog();
        log.setItem( item );
        log.setAttempt( attempt );
        log.setStartedAt( LocalDate.of( 2026, attempt, 1 ) );
        log.setFinishedAt( LocalDate.of( 2026, attempt, 20 ) );
        log.setRating( rating );
        return log;
    }
}
