package com.library.tracker.service.engagement;

import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class StreakServiceTest {

    private static final LocalDate TODAY = LocalDate.of( 2026, 8, 7 );

    private static final Clock FIXED_CLOCK = Clock.fixed( Instant.parse( "2026-08-07T10:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private ReadingSessionRepository readingSessionRepository;

    @Mock
    private UserService userService;

    private StreakService service() {
        return new StreakService( readingSessionRepository, userService, FIXED_CLOCK );
    }

    @Test
    void countsConsecutiveDaysEndingToday() {
        List<LocalDate> dates = List.of( TODAY.minusDays( 2 ), TODAY.minusDays( 1 ), TODAY );

        assertThat( service().currentStreak( dates, TODAY ) ).isEqualTo( 3 );
    }

    /**
     * Вчерашняя отметка серию не рвёт: требовать отметки именно сегодня значит обнулять стрик
     * каждому, кто читает по вечерам, — а стрик, который рвётся сам, никого не удерживает.
     */
    @Test
    void yesterdayKeepsStreakAlive() {
        List<LocalDate> dates = List.of( TODAY.minusDays( 2 ), TODAY.minusDays( 1 ) );

        assertThat( service().currentStreak( dates, TODAY ) ).isEqualTo( 2 );
    }

    @Test
    void twoMissedDaysBreakStreak() {
        List<LocalDate> dates = List.of( TODAY.minusDays( 5 ), TODAY.minusDays( 4 ), TODAY.minusDays( 3 ) );

        assertThat( service().currentStreak( dates, TODAY ) ).isZero();
    }

    @Test
    void longestStreakIgnoresGaps() {
        List<LocalDate> dates = List.of(
                TODAY.minusDays( 20 ), TODAY.minusDays( 19 ), TODAY.minusDays( 18 ), TODAY.minusDays( 17 ),
                TODAY.minusDays( 5 ), TODAY.minusDays( 4 ),
                TODAY
        );

        assertThat( service().longestStreak( dates ) ).isEqualTo( 4 );
    }

    @Test
    void emptyHistoryHasNoStreak() {
        assertThat( service().currentStreak( List.of(), TODAY ) ).isZero();
        assertThat( service().longestStreak( List.of() ) ).isZero();
    }

    /** Полоска активности показывает восемь недель, а не всю историю чтения. */
    @Test
    void recentDaysAreLimitedToEightWeeks() {
        UUID userId = UUID.randomUUID();
        when( readingSessionRepository.findReadingDates( eq( userId ), any(), any() ) )
                .thenReturn( List.of( TODAY.minusDays( 100 ), TODAY.minusDays( 10 ), TODAY ) );

        var response = service().forUser( userId );

        assertThat( response.getRecentDays() ).containsExactly( TODAY.minusDays( 10 ), TODAY );
        assertThat( response.isReadToday() ).isTrue();
        assertThat( response.getLastReadOn() ).isEqualTo( TODAY );
    }
}
