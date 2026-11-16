package com.library.tracker.service.analytics;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.AuthorCountResponse;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import com.library.tracker.web.dto.DayActivityResponse;
import com.library.tracker.web.dto.FinishForecastResponse;
import com.library.tracker.web.dto.LabelCountResponse;
import com.library.tracker.web.dto.PeriodStatsResponse;
import com.library.tracker.web.dto.PurchaseStatsResponse;
import com.library.tracker.web.dto.ReadingAnalyticsResponse;
import com.library.tracker.web.dto.ReadingPaceResponse;
import com.library.tracker.web.dto.SourceCountResponse;
import com.library.tracker.web.dto.TypeCountResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Аналитика библиотеки. Живёт отдельно от {@code LibraryItemService} по двум причинам: тот и без
 * того отвечает за весь жизненный цикл записи, а разрешение области видимости нужно обоим срезам
 * аналитики — держать его копию в двух сервисах хуже, чем вынести оба метода сюда.
 * <p>
 * Срезов два, и разделены они по цене, а не по теме. Сводка ({@link #bookAnalytics}) висит в шапке
 * списка книг и профиля, поэтому остаётся шестью счётчиками. Всё, что требует обхода истории
 * чтения, лежит в {@link #readingAnalytics} и запрашивается только со страницы аналитики.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    /** Окно помесячной динамики: два года дают сравнение с прошлым годом на том же графике. */
    private static final int MONTHS_WINDOW = 24;

    /** 53 полных недели — столько клеток в тепловой карте за год. */
    private static final int HEATMAP_DAYS = 371;

    /** Окно темпа. Меньше — и одна отпускная неделя перекашивает скорость, больше — темп отстаёт. */
    private static final int PACE_WINDOW_DAYS = 90;

    private static final int TOP_AUTHORS = 10;

    /** Прогнозов показываем столько: дальше это уже список «читаю», а не подсказка. */
    private static final int TOP_FORECASTS = 5;

    private final LibraryItemRepository libraryItemRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final UserService userService;
    private final Clock clock;

    @Transactional( readOnly = true )
    public BookAnalyticsResponse bookAnalytics( Optional<UUID> userId ) {
        UUID targetUserId = resolveTargetUserId( userId );

        long totalItems = libraryItemRepository.countAllByUserId( targetUserId );
        long favoriteItems = libraryItemRepository.countFavorites( targetUserId );
        Double avg = libraryItemRepository.averageRating( targetUserId );

        var statusBreakdown = libraryItemRepository.countByStatus( targetUserId )
                                                   .stream()
                                                   .collect( Collectors.toMap(
                                                           LibraryItemRepository.StatusCount::getStatus,
                                                           LibraryItemRepository.StatusCount::getCount ) );

        var kindBreakdown = libraryItemRepository.countByKind( targetUserId )
                                                 .stream()
                                                 .collect( Collectors.toMap(
                                                         LibraryItemRepository.KindCount::getKind,
                                                         LibraryItemRepository.KindCount::getCount ) );

        var topTypes = libraryItemRepository.countByType( targetUserId )
                                            .stream()
                                            .map( tc -> TypeCountResponse.builder()
                                                                         .typeId( tc.getTypeId() )
                                                                         .typeName( tc.getTypeName() )
                                                                         .count( tc.getCount() )
                                                                         .build() )
                                            .toList();

        var topSources = libraryItemRepository.countBySource( targetUserId )
                                              .stream()
                                              .map( sc -> SourceCountResponse.builder()
                                                                             .sourceId( sc.getSourceId() )
                                                                             .sourceName( sc.getSourceName() )
                                                                             .count( sc.getCount() )
                                                                             .build() )
                                              .toList();

        return BookAnalyticsResponse.builder()
                                    .totalItems( totalItems )
                                    .favoriteItems( favoriteItems )
                                    .averageRating( avg != null ? BigDecimal.valueOf( avg ) : null )
                                    .statusBreakdown( statusBreakdown )
                                    .kindBreakdown( kindBreakdown )
                                    .topTypes( topTypes )
                                    .topSources( topSources )
                                    .build();
    }

    @Transactional( readOnly = true )
    public ReadingAnalyticsResponse readingAnalytics( Optional<UUID> userId ) {
        UUID targetUserId = resolveTargetUserId( userId );
        LocalDate today = LocalDate.now( clock );

        List<PeriodStatsResponse> byMonth = byMonth( targetUserId, today );
        List<PeriodStatsResponse> byYear = byYear( targetUserId, today );
        ReadingPaceResponse pace = pace( targetUserId, today );

        return ReadingAnalyticsResponse.builder()
                                       .byMonth( byMonth )
                                       .byYear( byYear )
                                       .heatmap( heatmap( targetUserId, today ) )
                                       .pace( pace )
                                       .forecasts( forecasts( targetUserId, today, pace ) )
                                       .byAuthor( byAuthor( targetUserId ) )
                                       .byLanguage( byLanguage( targetUserId ) )
                                       .byDecade( byDecade( targetUserId ) )
                                       .purchases( purchases( targetUserId ) )
                                       .currentYear( yearToDate( targetUserId, today ) )
                                       .previousYear( yearToDate( targetUserId, today.minusYears( 1 ) ) )
                                       .build();
    }

    /**
     * Область видимости: администратор смотрит и по всей базе ({@code null}), и по конкретному
     * человеку, остальные — только себя. Правило одно на оба среза, поэтому и метод один.
     */
    private UUID resolveTargetUserId( Optional<UUID> userId ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        if ( userId.isPresent() && !isAdmin && !userId.get().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Недостаточно прав для просмотра аналитики другого пользователя" );
        }

        return userId.filter( id -> isAdmin || id.equals( currentUser.getId() ) )
                     .orElseGet( () -> isAdmin ? null : currentUser.getId() );
    }

    /**
     * Дочитанное считается по карточкам, минуты — по сессиям чтения: это разные таблицы и разные
     * запросы, и сводятся они здесь по ключу «год-месяц». Пустые месяцы внутри окна достраиваются,
     * иначе провал в графике выглядел бы как отсутствие данных.
     */
    private List<PeriodStatsResponse> byMonth( UUID userId, LocalDate today ) {
        LocalDate from = today.withDayOfMonth( 1 ).minusMonths( MONTHS_WINDOW - 1L );

        Map<String, LibraryItemRepository.PeriodCount> finished =
                libraryItemRepository.countFinishedByMonth( userId, from )
                                     .stream()
                                     .collect( Collectors.toMap( pc -> monthKey( pc.getYear(), pc.getMonth() ),
                                                                 pc -> pc ) );
        Map<String, Long> minutes =
                readingSessionRepository.minutesByMonth( userId, from )
                                        .stream()
                                        .collect( Collectors.toMap( mm -> monthKey( mm.getYear(), mm.getMonth() ),
                                                                    ReadingSessionRepository.MonthMinutes::getMinutes ) );

        return IntStream.range( 0, MONTHS_WINDOW )
                        .mapToObj( from::plusMonths )
                        .map( month -> {
                            String key = monthKey( month.getYear(), month.getMonthValue() );
                            var stats = finished.get( key );
                            return PeriodStatsResponse.builder()
                                                      .period( key )
                                                      .finished( stats != null ? stats.getFinished() : 0 )
                                                      .pages( stats != null ? stats.getPages() : 0 )
                                                      .minutes( minutes.getOrDefault( key, 0L ) )
                                                      .build();
                        } )
                        .toList();
    }

    /**
     * Годы отдаются подряд от первого с активностью до текущего: пропуск года — тоже результат,
     * и сжимать шкалу до «лет, в которых что-то было» значило бы его спрятать.
     */
    private List<PeriodStatsResponse> byYear( UUID userId, LocalDate today ) {
        Map<Integer, LibraryItemRepository.PeriodCount> finished =
                libraryItemRepository.countFinishedByYear( userId )
                                     .stream()
                                     .collect( Collectors.toMap( LibraryItemRepository.PeriodCount::getYear,
                                                                 pc -> pc ) );
        if ( finished.isEmpty() ) {
            return List.of();
        }

        int firstYear = finished.keySet().stream().min( Integer::compareTo ).orElse( today.getYear() );
        int lastYear = Math.max( today.getYear(), finished.keySet().stream().max( Integer::compareTo ).orElse( today.getYear() ) );

        // Минуты по годам считаются из тех же помесячных сумм, что и график: отдельный запрос
        // к сессиям дал бы третий проход по той же таблице ради тех же чисел.
        Map<Integer, Long> minutes = new LinkedHashMap<>();
        readingSessionRepository.minutesByMonth( userId, LocalDate.of( firstYear, 1, 1 ) )
                                .forEach( mm -> minutes.merge( mm.getYear(), mm.getMinutes(), Long::sum ) );

        return IntStream.rangeClosed( firstYear, lastYear )
                        .mapToObj( year -> {
                            var stats = finished.get( year );
                            return PeriodStatsResponse.builder()
                                                      .period( String.valueOf( year ) )
                                                      .finished( stats != null ? stats.getFinished() : 0 )
                                                      .pages( stats != null ? stats.getPages() : 0 )
                                                      .minutes( minutes.getOrDefault( year, 0L ) )
                                                      .build();
                        } )
                        .toList();
    }

    private List<DayActivityResponse> heatmap( UUID userId, LocalDate today ) {
        LocalDate from = today.minusDays( HEATMAP_DAYS - 1L );
        return readingSessionRepository.activityByDay( userId, from, today )
                                       .stream()
                                       .map( day -> DayActivityResponse.builder()
                                                                       .date( day.getDate() )
                                                                       .minutes( day.getMinutes() )
                                                                       .sessions( day.getSessions() )
                                                                       .build() )
                                       .toList();
    }

    private ReadingPaceResponse pace( UUID userId, LocalDate today ) {
        LocalDate from = today.minusDays( PACE_WINDOW_DAYS - 1L );
        var totals = readingSessionRepository.paceTotals( userId, from, today );
        long activeDays = totals != null ? totals.getActiveDays() : 0;
        long positions = totals != null ? totals.getPositions() : 0;
        long minutes = totals != null ? totals.getMinutes() : 0;

        return ReadingPaceResponse.builder()
                                  .pagesPerDay( divide( positions, activeDays ) )
                                  .minutesPerDay( divide( minutes, activeDays ) )
                                  .pagesPerHour( minutes > 0
                                                         ? BigDecimal.valueOf( positions * 60L )
                                                                     .divide( BigDecimal.valueOf( minutes ), 1,
                                                                              RoundingMode.HALF_UP )
                                                         : null )
                                  .activeDays( activeDays )
                                  .windowDays( PACE_WINDOW_DAYS )
                                  .build();
    }

    /**
     * Прогноз строится от темпа за окно, а не от скорости внутри конкретной записи: своей истории
     * у большинства записей слишком мало, чтобы из неё что-то следовало. Дни считаются
     * по календарю, а не по дням с чтением, — иначе дата уехала бы в прошлое у тех, кто читает
     * раз в неделю.
     */
    private List<FinishForecastResponse> forecasts( UUID userId, LocalDate today, ReadingPaceResponse pace ) {
        BigDecimal perActiveDay = pace.getPagesPerDay();
        long activeDays = pace.getActiveDays();

        BigDecimal perCalendarDay = perActiveDay != null && perActiveDay.signum() > 0 && activeDays > 0
                ? perActiveDay.multiply( BigDecimal.valueOf( activeDays ) )
                              .divide( BigDecimal.valueOf( PACE_WINDOW_DAYS ), 4, RoundingMode.HALF_UP )
                : null;

        return libraryItemRepository.findInProgressWithProgress( userId )
                                    .stream()
                                    .map( item -> forecast( item, today, perCalendarDay ) )
                                    .sorted( Comparator.comparing( FinishForecastResponse::getExpectedFinish,
                                                                   Comparator.nullsLast( Comparator.naturalOrder() ) )
                                                       .thenComparing( FinishForecastResponse::getRemaining ) )
                                    .limit( TOP_FORECASTS )
                                    .toList();
    }

    private FinishForecastResponse forecast( LibraryItem item, LocalDate today, BigDecimal perCalendarDay ) {
        int remaining = item.getProgressTotal() - item.getProgressCurrent();
        LocalDate expected = null;
        if ( perCalendarDay != null && perCalendarDay.signum() > 0 ) {
            long days = BigDecimal.valueOf( remaining )
                                  .divide( perCalendarDay, 0, RoundingMode.CEILING )
                                  .longValue();
            expected = today.plusDays( days );
        }

        ProgressUnit unit = item.getProgressUnit() != null
                ? item.getProgressUnit()
                : item.getKind().defaultProgressUnit();

        return FinishForecastResponse.builder()
                                     .itemId( item.getId() )
                                     .title( item.getTitle() )
                                     .remaining( remaining )
                                     .unit( unit != null ? unit.name() : null )
                                     .expectedFinish( expected )
                                     .build();
    }

    private List<AuthorCountResponse> byAuthor( UUID userId ) {
        return libraryItemRepository.countByAuthorNamed( userId, PageRequest.of( 0, TOP_AUTHORS ) )
                                    .stream()
                                    .map( ac -> AuthorCountResponse.builder()
                                                                   .authorId( ac.getAuthorId() )
                                                                   .authorName( ac.getAuthorName() )
                                                                   .count( ac.getCount() )
                                                                   .build() )
                                    .toList();
    }

    private List<LabelCountResponse> byLanguage( UUID userId ) {
        return libraryItemRepository.countByLanguage( userId )
                                    .stream()
                                    .map( lc -> LabelCountResponse.builder()
                                                                  .label( lc.getLabel() )
                                                                  .count( lc.getCount() )
                                                                  .build() )
                                    .toList();
    }

    private List<LabelCountResponse> byDecade( UUID userId ) {
        return libraryItemRepository.countByDecade( userId )
                                    .stream()
                                    .map( dc -> LabelCountResponse.builder()
                                                                  .label( dc.getDecade() + "-е" )
                                                                  .count( dc.getCount() )
                                                                  .build() )
                                    .toList();
    }

    private PurchaseStatsResponse purchases( UUID userId ) {
        Map<String, BigDecimal> spent = new LinkedHashMap<>();
        libraryItemRepository.sumPriceByCurrency( userId )
                             .forEach( ct -> spent.merge( currencyLabel( ct.getCurrency() ),
                                                          ct.getTotal() != null ? ct.getTotal() : BigDecimal.ZERO,
                                                          BigDecimal::add ) );

        return PurchaseStatsResponse.builder()
                                    .purchased( libraryItemRepository.countPurchased( userId ) )
                                    .finishedOfPurchased( libraryItemRepository.countPurchasedFinished( userId ) )
                                    .unreadPurchased( libraryItemRepository.countPurchasedUnread( userId ) )
                                    .spentByCurrency( spent )
                                    .build();
    }

    /** Цена без валюты — обычная ситуация при импорте; в отчёте она отдельной строкой «—». */
    private String currencyLabel( String currency ) {
        return currency == null || currency.isBlank() ? "—" : currency.toUpperCase( Locale.ROOT );
    }

    /**
     * Год с первого января по указанный день. Сравнение «год к году» берёт два таких отрезка,
     * а не два полных года: в августе полный прошлый год всегда больше текущего просто потому,
     * что текущий ещё не кончился, и «−57%» говорило бы о календаре, а не о чтении.
     * <p>
     * 29 февраля {@code minusYears} переводит в 28-е — отрезок остаётся сопоставимым.
     */
    private PeriodStatsResponse yearToDate( UUID userId, LocalDate through ) {
        LocalDate from = through.withDayOfYear( 1 );
        var totals = libraryItemRepository.finishedBetweenScoped( userId, from, through );

        return PeriodStatsResponse.builder()
                                  .period( String.valueOf( through.getYear() ) )
                                  .finished( totals != null ? totals.getFinished() : 0 )
                                  .pages( totals != null ? totals.getPages() : 0 )
                                  .minutes( readingSessionRepository.sumMinutesScoped( userId, from, through ) )
                                  .build();
    }

    private BigDecimal divide( long value, long divisor ) {
        return divisor > 0
                ? BigDecimal.valueOf( value ).divide( BigDecimal.valueOf( divisor ), 1, RoundingMode.HALF_UP )
                : null;
    }

    private String monthKey( int year, int month ) {
        return "%d-%02d".formatted( year, month );
    }
}
