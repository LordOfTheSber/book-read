package com.library.tracker.service.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Series;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.SmartShelfRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.service.importing.CsvImportParser;
import com.library.tracker.web.dto.LibraryImportRow;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
@MockitoSettings( strictness = Strictness.LENIENT )
class UserDataExportServiceTest {

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private ReadingLogRepository readingLogRepository;

    @Mock
    private ReadingSessionRepository readingSessionRepository;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private LoanRepository loanRepository;

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private SmartShelfRepository smartShelfRepository;

    @Mock
    private TagRepository tagRepository;

    @Mock
    private ReadingGoalRepository readingGoalRepository;

    @Mock
    private UserAchievementRepository userAchievementRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule( new JavaTimeModule() );

    private UserDataExportService service;

    private User owner;

    private LibraryItem item;

    @BeforeEach
    void setUp() {
        service = new UserDataExportService( libraryItemRepository, readingLogRepository, readingSessionRepository,
                                             quoteRepository, loanRepository, shelfRepository, smartShelfRepository,
                                             tagRepository, readingGoalRepository, userAchievementRepository,
                                             objectMapper );

        owner = new User();
        owner.setId( UUID.randomUUID() );
        owner.setUsername( "reader" );
        owner.setPassword( "$2a$10$hash" );
        owner.setDisplayName( "Читатель" );

        item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Задача трёх тел" );
        item.setIsbn( "9785171049676" );
        item.setPublishedYear( 2008 );
        item.setPageCount( 400 );
        item.setRating( new BigDecimal( "8.5" ) );
        item.setStatus( ReadingStatus.COMPLETED );
        item.setStartedAt( LocalDate.of( 2026, 1, 10 ) );
        item.setFinishedAt( LocalDate.of( 2026, 2, 3 ) );
        item.setReview( "Отличная научная фантастика" );
        item.setNote( "Взял в бумаге" );
        item.setLanguage( "русский" );

        Series series = new Series();
        series.setId( UUID.randomUUID() );
        series.setName( "Воспоминания о прошлом Земли" );
        item.setSeries( series );

        when( libraryItemRepository.findByCreatedById( any(), any( Pageable.class ) ) )
                .thenAnswer( invocation -> {
                    Pageable pageable = invocation.getArgument( 1 );
                    return pageable.getPageNumber() == 0
                            ? new PageImpl<>( List.of( item ), pageable, 1 )
                            : new PageImpl<LibraryItem>( List.of(), pageable, 1 );
                } );
        when( libraryItemRepository.findAuthorsByItemIds( any() ) ).thenReturn( List.of( authorRow( "Лю Цысинь" ) ) );
        when( tagRepository.findTagsByItemIds( any() ) ).thenReturn( List.of( tagRow( "фантастика" ) ) );
        when( shelfRepository.findShelvesByItemIds( any(), any() ) ).thenReturn( List.of() );
        when( readingLogRepository.findByItemIdInOrderByItemIdAscAttemptAsc( any() ) ).thenReturn( List.of() );
        when( readingSessionRepository.findByItemIdInOrderByItemIdAscSessionDateAsc( any() ) ).thenReturn( List.of() );
        when( quoteRepository.findByItemIdInOrderByItemIdAscPositionAsc( any() ) ).thenReturn( List.of() );
        when( loanRepository.findByItemIdInOrderByItemIdAscLentOnAsc( any() ) ).thenReturn( List.of() );
        when( tagRepository.findByOwnerIdOrderByNameAsc( any() ) ).thenReturn( List.of() );
        when( shelfRepository.findByOwnerIdOrderByNameAsc( any() ) ).thenReturn( List.of() );
        when( smartShelfRepository.findByOwnerIdOrderByNameAsc( any() ) ).thenReturn( List.of() );
        when( readingGoalRepository.findByOwnerIdOrderByYearDesc( any() ) ).thenReturn( List.of() );
        when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( any() ) ).thenReturn( List.of() );
    }

    /**
     * Главное свойство табличной выгрузки: она читается обратно. Проверяется не текстом заголовка,
     * а прогоном через тот самый разбор, которым пользуется страница импорта.
     */
    @Test
    void csvIsReadableBackByImportParser() throws Exception {
        LibraryImportRow row = parseBack( csv() );

        assertThat( row.getTitle() ).isEqualTo( "Задача трёх тел" );
        assertThat( row.getAuthorNames() ).containsExactly( "Лю Цысинь" );
        assertThat( row.getIsbn() ).isEqualTo( "9785171049676" );
        assertThat( row.getPublishedYear() ).isEqualTo( 2008 );
        assertThat( row.getPageCount() ).isEqualTo( 400 );
        assertThat( row.getStatus() ).isEqualTo( ReadingStatus.COMPLETED );
        assertThat( row.getStartedAt() ).isEqualTo( LocalDate.of( 2026, 1, 10 ) );
        assertThat( row.getFinishedAt() ).isEqualTo( LocalDate.of( 2026, 2, 3 ) );
        assertThat( row.getReview() ).isEqualTo( "Отличная научная фантастика" );
        assertThat( row.getNote() ).isEqualTo( "Взял в бумаге" );
        assertThat( row.getSeriesName() ).isEqualTo( "Воспоминания о прошлом Земли" );
        assertThat( row.getTagNames() ).containsExactly( "фантастика" );
    }

    /**
     * Оценка не должна удвоиться на обратном пути. Разбор умножает на два всё, что опознал как
     * выгрузку Goodreads или StoryGraph, — заголовки подобраны так, чтобы наш файл опознавался
     * как GENERIC и десятибалльная шкала оставалась десятибалльной.
     */
    @Test
    void csvKeepsTenPointRatingIntact() throws Exception {
        assertThat( parseBack( csv() ).getRating() ).isEqualByComparingTo( "8.5" );
    }

    @Test
    void csvRoundTripsEveryStatus() throws Exception {
        for ( ReadingStatus status : ReadingStatus.values() ) {
            item.setStatus( status );
            assertThat( parseBack( csv() ).getStatus() ).isEqualTo( status );
        }
    }

    /** Табличному формату история чтения не нужна — и запросов за ней он делать не должен. */
    @Test
    void csvDoesNotLoadReadingHistory() throws Exception {
        csv();

        verify( readingSessionRepository, never() ).findByItemIdInOrderByItemIdAscSessionDateAsc( any() );
        verify( quoteRepository, never() ).findByItemIdInOrderByItemIdAscPositionAsc( any() );
    }

    @Test
    void jsonCarriesWhatCsvCannot() throws Exception {
        when( quoteRepository.findByItemIdInOrderByItemIdAscPositionAsc( any() ) )
                .thenReturn( List.of( quote( 120, "Тёмный лес" ) ) );

        JsonNode json = objectMapper.readTree( json() );
        JsonNode exported = json.get( "items" ).get( 0 );

        assertThat( exported.get( "title" ).asText() ).isEqualTo( "Задача трёх тел" );
        assertThat( exported.get( "language" ).asText() ).isEqualTo( "русский" );
        assertThat( exported.get( "authors" ).get( 0 ).asText() ).isEqualTo( "Лю Цысинь" );
        assertThat( exported.get( "quotes" ).get( 0 ).get( "text" ).asText() ).isEqualTo( "Тёмный лес" );
        assertThat( json.get( "profile" ).get( "username" ).asText() ).isEqualTo( "reader" );
    }

    /** Личная выгрузка — это не административный бэкап: хеша пароля в ней быть не должно. */
    @Test
    void jsonNeverCarriesPasswordHash() throws Exception {
        assertThat( json() ).doesNotContain( "$2a$10$hash" ).doesNotContain( "password" );
    }

    /** Пустые поля не пишутся: файл читает человек, и колонка из null ему ничего не сообщает. */
    @Test
    void jsonOmitsEmptyFields() throws Exception {
        item.setTranslator( null );
        item.setPurchaseUrl( null );

        JsonNode exported = objectMapper.readTree( json() ).get( "items" ).get( 0 );

        assertThat( exported.has( "translator" ) ).isFalse();
        assertThat( exported.has( "purchaseUrl" ) ).isFalse();
        assertThat( exported.has( "loans" ) ).isFalse();
    }

    @Test
    void fileNameCarriesUsernameAndFormat() {
        assertThat( service.fileName( owner, "csv" ) ).startsWith( "library-reader-" ).endsWith( ".csv" );
        assertThat( service.fileName( owner, "json" ) ).endsWith( ".json" );
    }

    private String csv() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.writeCsv( owner, output );
        return output.toString( StandardCharsets.UTF_8 );
    }

    private String json() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.writeJson( owner, output );
        return output.toString( StandardCharsets.UTF_8 );
    }

    private LibraryImportRow parseBack( String csv ) throws Exception {
        CsvImportParser.Parsed parsed = new CsvImportParser()
                .parse( new ByteArrayInputStream( csv.getBytes( StandardCharsets.UTF_8 ) ), "library.csv" );
        assertThat( parsed.source() ).isEqualTo( "GENERIC" );
        assertThat( parsed.rows() ).hasSize( 1 );
        return parsed.rows().getFirst();
    }

    private Quote quote( int position, String text ) {
        Quote quote = new Quote();
        quote.setId( UUID.randomUUID() );
        quote.setItem( item );
        quote.setPosition( position );
        quote.setText( text );
        return quote;
    }

    private LibraryItemRepository.ItemAuthorRow authorRow( String name ) {
        return new LibraryItemRepository.ItemAuthorRow() {

            @Override
            public UUID getItemId() {
                return item.getId();
            }

            @Override
            public UUID getAuthorId() {
                return UUID.randomUUID();
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getAltName() {
                return null;
            }
        };
    }

    private TagRepository.ItemTagRow tagRow( String name ) {
        return new TagRepository.ItemTagRow() {

            @Override
            public UUID getItemId() {
                return item.getId();
            }

            @Override
            public UUID getTagId() {
                return UUID.randomUUID();
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getColor() {
                return null;
            }
        };
    }
}
