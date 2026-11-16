package com.library.tracker.service.engagement;

import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.StreakResponse;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Дни подряд с чтением. Считается по заходам, а не по завершённым книгам: книга закрывается раз
 * в неделю, а привычку показывает именно ежедневная отметка.
 * <p>
 * Серия считается живой, пока последний заход не старше вчерашнего. Требовать отметки именно
 * сегодня значит рвать стрик каждому, кто читает по вечерам и однажды лёг раньше, — а стрик,
 * который рвётся сам, никого не удерживает.
 */
@Service
@RequiredArgsConstructor
public class StreakService {

    /** Границы «за всё время»: истории раньше этой даты в трекере быть не может. */
    public static final LocalDate EPOCH = LocalDate.of( 1970, 1, 1 );

    public static final LocalDate FAR_FUTURE = LocalDate.of( 2200, 1, 1 );

    /** Восемь недель — столько дней показывается полоской активности. */
    private static final int RECENT_DAYS = 56;

    private final ReadingSessionRepository readingSessionRepository;
    private final UserService userService;
    private final Clock clock;

    @Transactional( readOnly = true )
    public StreakResponse forCurrentUser() {
        return forUser( userService.getCurrentUser().getId() );
    }

    @Transactional( readOnly = true )
    public StreakResponse forUser( UUID userId ) {
        LocalDate today = LocalDate.now( clock );
        List<LocalDate> dates = readingSessionRepository.findReadingDates( userId, EPOCH, today );

        LocalDate earliestRecent = today.minusDays( RECENT_DAYS - 1L );
        return StreakResponse.builder()
                             .currentStreak( currentStreak( dates, today ) )
                             .longestStreak( longestStreak( dates ) )
                             .lastReadOn( dates.isEmpty() ? null : dates.get( dates.size() - 1 ) )
                             .readToday( !dates.isEmpty() && dates.get( dates.size() - 1 ).isEqual( today ) )
                             .recentDays( dates.stream().filter( date -> !date.isBefore( earliestRecent ) ).toList() )
                             .build();
    }

    /** Короткий ответ для профиля: там нужна одна цифра, а не вся история. */
    @Transactional( readOnly = true )
    public int currentStreak( UUID userId ) {
        LocalDate today = LocalDate.now( clock );
        return currentStreak( readingSessionRepository.findReadingDates( userId, EPOCH, today ), today );
    }

    /** Даты приходят упорядоченными и различными — это гарантирует запрос. */
    int currentStreak( List<LocalDate> dates, LocalDate today ) {
        if ( dates.isEmpty() ) {
            return 0;
        }
        LocalDate last = dates.get( dates.size() - 1 );
        if ( ChronoUnit.DAYS.between( last, today ) > 1 ) {
            return 0;
        }

        int streak = 1;
        for ( int i = dates.size() - 1; i > 0; i-- ) {
            if ( ChronoUnit.DAYS.between( dates.get( i - 1 ), dates.get( i ) ) != 1 ) {
                break;
            }
            streak++;
        }
        return streak;
    }

    int longestStreak( List<LocalDate> dates ) {
        int longest = 0;
        int run = 0;
        LocalDate previous = null;
        for ( LocalDate date : dates ) {
            run = previous != null && ChronoUnit.DAYS.between( previous, date ) == 1 ? run + 1 : 1;
            longest = Math.max( longest, run );
            previous = date;
        }
        return longest;
    }
}
