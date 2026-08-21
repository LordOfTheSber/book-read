package com.library.tracker.service.analytics;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import com.library.tracker.web.dto.PeriodStatsResponse;
import com.library.tracker.web.dto.ReadingAnalyticsResponse;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
@MockitoSettings( strictness = Strictness.LENIENT )
class AnalyticsServiceTest {

    /** Окна аналитики отсчитываются от «сегодня», поэтому дата в тестах фиксирована. */
    private static final Clock FIXED_CLOCK =
            Clock.fixed( Instant.parse( "2026-03-15T10:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private ReadingSessionRepository readingSessionRepository;

    @Mock
    private UserService userService;

    private AnalyticsService service;

    private User currentUser;

    @BeforeEach
    void setUp() {
        service = new AnalyticsService( libraryItemRepository, readingSessionRepository, userService, FIXED_CLOCK );
        currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );

        when( libraryItemRepository.countFinishedByMonth( any(), any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countFinishedByYear( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countByAuthorNamed( any(), any( Pageable.class ) ) ).thenReturn( List.of() );
        when( libraryItemRepository.countByLanguage( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countByDecade( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.sumPriceByCurrency( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.findInProgressWithProgress( any() ) ).thenReturn( List.of() );
        when( readingSessionRepository.activityByDay( any(), any(), any() ) ).thenReturn( List.of() );
        when( readingSessionRepository.minutesByMonth( any(), any() ) ).thenReturn( List.of() );
        when( readingSessionRepository.paceTotals( any(), any(), any() ) ).thenReturn( paceTotals( 0, 0, 0 ) );
        when( readingSessionRepository.sumMinutesScoped( any(), any(), any() ) ).thenReturn( 0L );
        when( libraryItemRepository.finishedBetweenScoped( any(), any(), any() ) ).thenReturn( rangeTotals( 0, 0 ) );
    }

    @Test
    void rejectsUnauthorizedUserAccess() {
        assertThatThrownBy( () -> service.readingAnalytics( Optional.of( UUID.randomUUID() ) ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Недостаточно прав для просмотра аналитики другого пользователя" );
    }

    @Test
    void bookAnalyticsRejectsUnauthorizedUserAccess() {
        assertThatThrownBy( () -> service.bookAnalytics( Optional.of( UUID.randomUUID() ) ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Недостаточно прав для просмотра аналитики другого пользователя" );
    }

    /** Корешковая полоса на клиенте рисуется по этой разбивке — значит, она должна доезжать. */
    @Test
    void bookAnalyticsCountsItemsByKind() {
        when( libraryItemRepository.countByStatus( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countByType( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countBySource( any() ) ).thenReturn( List.of() );
        when( libraryItemRepository.countByKind( any() ) )
                .thenReturn( List.of( kindCount( MediaKind.BOOK, 104 ), kindCount( MediaKind.MANGA, 40 ) ) );

        BookAnalyticsResponse response = service.bookAnalytics( Optional.empty() );

        assertThat( response.getKindBreakdown() )
                .containsEntry( MediaKind.BOOK, 104L )
                .containsEntry( MediaKind.MANGA, 40L );
    }

    @Test
    void adminWithoutUserIdLooksAtWholeDatabase() {
        currentUser.setRole( Role.ADMIN );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( true );

        service.readingAnalytics( Optional.empty() );

        // null здесь — не «пользователь не найден», а режим «вся база»; проверяем именно его.
        org.mockito.Mockito.verify( libraryItemRepository ).countFinishedByYear( isNull() );
    }

    @Test
    void monthlySeriesFillsGapsAndMergesFinishedWithMinutes() {
        when( libraryItemRepository.countFinishedByMonth( any(), any() ) )
                .thenReturn( List.of( periodCount( 2026, 3, 2, 700 ) ) );
        when( readingSessionRepository.minutesByMonth( any(), any() ) )
                .thenReturn( List.of( monthMinutes( 2026, 2, 120 ), monthMinutes( 2026, 3, 45 ) ) );

        ReadingAnalyticsResponse response = service.readingAnalytics( Optional.empty() );

        assertThat( response.getByMonth() ).hasSize( 24 );
        assertThat( response.getByMonth() ).last().satisfies( march -> {
            assertThat( march.getPeriod() ).isEqualTo( "2026-03" );
            assertThat( march.getFinished() ).isEqualTo( 2 );
            assertThat( march.getPages() ).isEqualTo( 700 );
            assertThat( march.getMinutes() ).isEqualTo( 45 );
        } );

        PeriodStatsResponse february = response.getByMonth().get( 22 );
        assertThat( february.getPeriod() ).isEqualTo( "2026-02" );
        assertThat( february.getFinished() ).isZero();
        assertThat( february.getMinutes() ).isEqualTo( 120 );

        // Месяц без единой записи всё равно есть в ряду: провал в графике — это тоже результат.
        assertThat( response.getByMonth().getFirst().getPeriod() ).isEqualTo( "2024-04" );
        assertThat( response.getByMonth().getFirst().getFinished() ).isZero();
    }

    @Test
    void yearlySeriesRunsUninterruptedFromFirstActivityToToday() {
        when( libraryItemRepository.countFinishedByYear( any() ) )
                .thenReturn( List.of( periodCount( 2023, 0, 5, 1500 ), periodCount( 2026, 0, 1, 300 ) ) );

        ReadingAnalyticsResponse response = service.readingAnalytics( Optional.empty() );

        assertThat( response.getByYear() ).extracting( PeriodStatsResponse::getPeriod )
                                          .containsExactly( "2023", "2024", "2025", "2026" );
        assertThat( response.getByYear().get( 1 ).getFinished() ).isZero();
    }

    /**
     * Сравнение берёт два отрезка «с 1 января по этот день», а не два полных года: в марте полный
     * прошлый год всегда больше текущего, и разница говорила бы о календаре, а не о чтении.
     */
    @Test
    void yearComparisonUsesMatchingSlicesOfBothYears() {
        when( libraryItemRepository.finishedBetweenScoped( any(), eq( LocalDate.of( 2026, 1, 1 ) ),
                                                           eq( LocalDate.of( 2026, 3, 15 ) ) ) )
                .thenReturn( rangeTotals( 4, 1200 ) );
        when( libraryItemRepository.finishedBetweenScoped( any(), eq( LocalDate.of( 2025, 1, 1 ) ),
                                                           eq( LocalDate.of( 2025, 3, 15 ) ) ) )
                .thenReturn( rangeTotals( 2, 500 ) );
        when( readingSessionRepository.sumMinutesScoped( any(), eq( LocalDate.of( 2026, 1, 1 ) ),
                                                         eq( LocalDate.of( 2026, 3, 15 ) ) ) )
                .thenReturn( 300L );

        ReadingAnalyticsResponse response = service.readingAnalytics( Optional.empty() );

        assertThat( response.getCurrentYear().getPeriod() ).isEqualTo( "2026" );
        assertThat( response.getCurrentYear().getFinished() ).isEqualTo( 4 );
        assertThat( response.getCurrentYear().getPages() ).isEqualTo( 1200 );
        assertThat( response.getCurrentYear().getMinutes() ).isEqualTo( 300 );
        assertThat( response.getPreviousYear().getPeriod() ).isEqualTo( "2025" );
        assertThat( response.getPreviousYear().getFinished() ).isEqualTo( 2 );
    }

    @Test
    void yearComparisonIsEmptyWhenNothingWasEverFinished() {
        ReadingAnalyticsResponse response = service.readingAnalytics( Optional.empty() );

        assertThat( response.getByYear() ).isEmpty();
        assertThat( response.getCurrentYear().getPeriod() ).isEqualTo( "2026" );
        assertThat( response.getCurrentYear().getFinished() ).isZero();
        assertThat( response.getPreviousYear().getPeriod() ).isEqualTo( "2025" );
    }

    @Test
    void paceDividesByDaysWithReadingNotByWholeWindow() {
        when( readingSessionRepository.paceTotals( any(), any(), any() ) )
                .thenReturn( paceTotals( 600, 300, 10 ) );

        var pace = service.readingAnalytics( Optional.empty() ).getPace();

        assertThat( pace.getPagesPerDay() ).isEqualByComparingTo( "60.0" );
        assertThat( pace.getMinutesPerDay() ).isEqualByComparingTo( "30.0" );
        assertThat( pace.getPagesPerHour() ).isEqualByComparingTo( "120.0" );
        assertThat( pace.getActiveDays() ).isEqualTo( 10 );
        assertThat( pace.getWindowDays() ).isEqualTo( 90 );
    }

    @Test
    void paceIsNullWhenThereWereNoSessions() {
        var pace = service.readingAnalytics( Optional.empty() ).getPace();

        assertThat( pace.getPagesPerDay() ).isNull();
        assertThat( pace.getMinutesPerDay() ).isNull();
        assertThat( pace.getPagesPerHour() ).isNull();
        assertThat( pace.getActiveDays() ).isZero();
    }

    /**
     * 600 страниц за 10 дней чтения из 90 — это 6.67 страницы на календарный день, и 100 страниц
     * остатка занимают 15 дней. Считать по дням с чтением (60 страниц в день) значило бы обещать
     * два дня тому, кто открывает книгу раз в неделю.
     */
    @Test
    void forecastUsesCalendarDaysNotOnlyDaysWithReading() {
        when( readingSessionRepository.paceTotals( any(), any(), any() ) )
                .thenReturn( paceTotals( 600, 300, 10 ) );
        when( libraryItemRepository.findInProgressWithProgress( any() ) )
                .thenReturn( List.of( inProgress( "Дюна", 100, 200 ) ) );

        var forecasts = service.readingAnalytics( Optional.empty() ).getForecasts();

        assertThat( forecasts ).hasSize( 1 );
        assertThat( forecasts.getFirst().getTitle() ).isEqualTo( "Дюна" );
        assertThat( forecasts.getFirst().getRemaining() ).isEqualTo( 100 );
        assertThat( forecasts.getFirst().getUnit() ).isEqualTo( ProgressUnit.PAGES.name() );
        assertThat( forecasts.getFirst().getExpectedFinish() ).isEqualTo( LocalDate.of( 2026, 3, 30 ) );
    }

    @Test
    void forecastLeavesDateEmptyWithoutPace() {
        when( libraryItemRepository.findInProgressWithProgress( any() ) )
                .thenReturn( List.of( inProgress( "Дюна", 100, 200 ) ) );

        var forecasts = service.readingAnalytics( Optional.empty() ).getForecasts();

        assertThat( forecasts ).hasSize( 1 );
        assertThat( forecasts.getFirst().getExpectedFinish() ).isNull();
        assertThat( forecasts.getFirst().getRemaining() ).isEqualTo( 100 );
    }

    @Test
    void purchaseStatsKeepCurrenciesApart() {
        when( libraryItemRepository.countPurchased( any() ) ).thenReturn( 12L );
        when( libraryItemRepository.countPurchasedFinished( any() ) ).thenReturn( 7L );
        when( libraryItemRepository.countPurchasedUnread( any() ) ).thenReturn( 4L );
        when( libraryItemRepository.sumPriceByCurrency( any() ) )
                .thenReturn( List.of( currencyTotal( "rub", new BigDecimal( "3400.00" ) ),
                                      currencyTotal( "EUR", new BigDecimal( "25.50" ) ),
                                      currencyTotal( null, new BigDecimal( "10.00" ) ) ) );

        var purchases = service.readingAnalytics( Optional.empty() ).getPurchases();

        assertThat( purchases.getPurchased() ).isEqualTo( 12 );
        assertThat( purchases.getFinishedOfPurchased() ).isEqualTo( 7 );
        assertThat( purchases.getUnreadPurchased() ).isEqualTo( 4 );
        assertThat( purchases.getSpentByCurrency() ).containsOnlyKeys( "RUB", "EUR", "—" );
        assertThat( purchases.getSpentByCurrency().get( "RUB" ) ).isEqualByComparingTo( "3400.00" );
    }

    @Test
    void decadeLabelIsBuiltFromPublishedYear() {
        when( libraryItemRepository.countByDecade( any() ) ).thenReturn( List.of( decadeCount( 1980, 3 ) ) );

        var byDecade = service.readingAnalytics( Optional.empty() ).getByDecade();

        assertThat( byDecade ).singleElement().satisfies( decade -> {
            assertThat( decade.getLabel() ).isEqualTo( "1980-е" );
            assertThat( decade.getCount() ).isEqualTo( 3 );
        } );
    }

    private LibraryItem inProgress( String title, int current, int total ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setProgressCurrent( current );
        item.setProgressTotal( total );
        item.setProgressUnit( ProgressUnit.PAGES );
        return item;
    }

    private LibraryItemRepository.PeriodCount periodCount( int year, int month, long finished, long pages ) {
        return new LibraryItemRepository.PeriodCount() {

            @Override
            public int getYear() {
                return year;
            }

            @Override
            public int getMonth() {
                return month;
            }

            @Override
            public long getFinished() {
                return finished;
            }

            @Override
            public long getPages() {
                return pages;
            }
        };
    }

    private LibraryItemRepository.RangeTotals rangeTotals( long finished, long pages ) {
        return new LibraryItemRepository.RangeTotals() {

            @Override
            public long getFinished() {
                return finished;
            }

            @Override
            public long getPages() {
                return pages;
            }
        };
    }

    private LibraryItemRepository.DecadeCount decadeCount( int decade, long count ) {
        return new LibraryItemRepository.DecadeCount() {

            @Override
            public int getDecade() {
                return decade;
            }

            @Override
            public long getCount() {
                return count;
            }
        };
    }

    private LibraryItemRepository.CurrencyTotal currencyTotal( String currency, BigDecimal total ) {
        return new LibraryItemRepository.CurrencyTotal() {

            @Override
            public String getCurrency() {
                return currency;
            }

            @Override
            public BigDecimal getTotal() {
                return total;
            }
        };
    }

    private ReadingSessionRepository.MonthMinutes monthMinutes( int year, int month, long minutes ) {
        return new ReadingSessionRepository.MonthMinutes() {

            @Override
            public int getYear() {
                return year;
            }

            @Override
            public int getMonth() {
                return month;
            }

            @Override
            public long getMinutes() {
                return minutes;
            }
        };
    }

    private ReadingSessionRepository.PaceTotals paceTotals( long positions, long minutes, long activeDays ) {
        return new ReadingSessionRepository.PaceTotals() {

            @Override
            public long getPositions() {
                return positions;
            }

            @Override
            public long getMinutes() {
                return minutes;
            }

            @Override
            public long getActiveDays() {
                return activeDays;
            }
        };
    }

    private LibraryItemRepository.KindCount kindCount( MediaKind kind, long count ) {
        return new LibraryItemRepository.KindCount() {

            @Override
            public MediaKind getKind() {
                return kind;
            }

            @Override
            public long getCount() {
                return count;
            }
        };
    }
}
