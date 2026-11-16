package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.Author;
import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Series;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SeriesRepository;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Проверяет миграцию V10 против маппинга: расширенная карточка сохраняется и читается на настоящей
 * PostgreSQL, включая связь многие-ко-многим с авторами и дробный номер в серии.
 */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class LibraryItemCardIntegrationTest extends PostgresContainerTest {

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private SeriesRepository seriesRepository;

    @Test
    void savesAndReadsBackTheWholeCard() {
        Author first = authorRepository.save( author( "Лю Цысинь" ) );
        Author second = authorRepository.save( author( "Аркадий Стругацкий" ) );
        Series series = seriesRepository.save( series( "Воспоминания о прошлом Земли" ) );

        LibraryItem item = new LibraryItem();
        item.setTitle( "Задача трёх тел" );
        item.setStatus( ReadingStatus.PLANNED );
        item.setAuthors( new LinkedHashSet<>( Set.of( first, second ) ) );
        item.setSeries( series );
        item.setOrderInSeries( new BigDecimal( "2.50" ) );
        item.setIsbn( "9785171049676" );
        item.setPublishedYear( 2006 );
        item.setLanguage( "ru" );
        item.setPageCount( 400 );
        item.setTranslator( "Ольга Глушкова" );
        item.setFormat( ItemFormat.PAPER );
        item.setBookcase( "Гостиная" );
        item.setShelf( "Вторая сверху" );

        LibraryItem saved = libraryItemRepository.saveAndFlush( item );
        libraryItemRepository.flush();

        LibraryItem loaded = libraryItemRepository.findWithRelationsById( saved.getId() ).orElseThrow();
        assertThat( loaded.getAuthors() ).extracting( Author::getName )
                                         .containsExactlyInAnyOrder( "Лю Цысинь", "Аркадий Стругацкий" );
        assertThat( loaded.getSeries().getName() ).isEqualTo( "Воспоминания о прошлом Земли" );
        // Дробный номер нужен побочным повестям и должен пережить обход через NUMERIC(6,2).
        assertThat( loaded.getOrderInSeries() ).isEqualByComparingTo( "2.5" );
        assertThat( loaded.getIsbn() ).isEqualTo( "9785171049676" );
        assertThat( loaded.getPublishedYear() ).isEqualTo( 2006 );
        assertThat( loaded.getPageCount() ).isEqualTo( 400 );
        assertThat( loaded.getFormat() ).isEqualTo( ItemFormat.PAPER );
        assertThat( loaded.getBookcase() ).isEqualTo( "Гостиная" );
        assertThat( loaded.getShelf() ).isEqualTo( "Вторая сверху" );
    }

    /** Уникальность имени автора в миграции задана по LOWER(name) — проверяем, что она работает. */
    @Test
    void rejectsDuplicateAuthorNameDifferingOnlyInCase() {
        authorRepository.saveAndFlush( author( "Лю Цысинь" ) );

        assertThatThrownBy( () -> authorRepository.saveAndFlush( author( "лю цысинь" ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void findsAuthorsForWholePageInOneQuery() {
        Author author = authorRepository.save( author( "Лю Цысинь" ) );
        LibraryItem first = libraryItemRepository.save( itemWith( "Задача трёх тел", author ) );
        LibraryItem second = libraryItemRepository.save( itemWith( "Тёмный лес", author ) );
        libraryItemRepository.flush();

        List<LibraryItemRepository.ItemAuthorRow> rows =
                libraryItemRepository.findAuthorsByItemIds( List.of( first.getId(), second.getId() ) );

        assertThat( rows ).hasSize( 2 );
        assertThat( rows ).allSatisfy( row -> assertThat( row.getName() ).isEqualTo( "Лю Цысинь" ) );
    }

    private LibraryItem itemWith( String title, Author author ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setStatus( ReadingStatus.PLANNED );
        item.setAuthors( new LinkedHashSet<>( Set.of( author ) ) );
        return item;
    }

    private Author author( String name ) {
        Author author = new Author();
        author.setName( name );
        return author;
    }

    private Series series( String name ) {
        Series series = new Series();
        series.setName( name );
        return series;
    }
}
