package com.library.tracker.service.engagement;

import com.library.tracker.domain.Achievement;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserAchievement;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.service.social.ActivityService;
import com.library.tracker.web.dto.AchievementResponse;

import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Достижения. Условия живут здесь, а не в БД: порог и формулировку переписывают, и хранить их
 * строками значило бы чинить данные миграцией при каждой правке. Исчерпывающий {@code switch}
 * не даст завести достижение, которое никогда не выдаётся.
 * <p>
 * Проверка идёт по требованию — при открытии страницы и после завершения произведения. Ночной
 * пересчёт по всем пользователям был бы дороже и всё равно опаздывал бы на сутки.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class AchievementService {

    private final UserAchievementRepository userAchievementRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final QuoteRepository quoteRepository;
    private final ReadingGoalService readingGoalService;
    private final StreakService streakService;
    private final ActivityService activityService;
    private final UserService userService;
    private final Clock clock;

    @Transactional
    public List<AchievementResponse> listForCurrentUser() {
        return evaluate( userService.getCurrentUser() );
    }

    /** Выдаёт всё, что заслужено и ещё не выдано, и возвращает полный список — включая закрытые. */
    public List<AchievementResponse> evaluate( User user ) {
        Map<Achievement, LocalDate> unlocked = new EnumMap<>( Achievement.class );
        userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( user.getId() )
                                 .forEach( record -> parse( record.getCode() )
                                         .ifPresent( achievement -> unlocked.put( achievement,
                                                                                  record.getUnlockedOn() ) ) );

        Snapshot snapshot = snapshot( user.getId() );
        LocalDate today = LocalDate.now( clock );

        for ( Achievement achievement : Achievement.values() ) {
            if ( unlocked.containsKey( achievement ) || !isEarned( achievement, snapshot ) ) {
                continue;
            }
            UserAchievement record = new UserAchievement();
            record.setOwner( user );
            record.setCode( achievement.name() );
            record.setUnlockedOn( today );
            userAchievementRepository.save( record );
            unlocked.put( achievement, today );

            // Взятая цель года — это не «ещё одна плашка», а отдельное событие: в ленте оно
            // читается как итог, а не как побочный эффект.
            ActivityType type = achievement == Achievement.GOAL_KEEPER
                    ? ActivityType.REACHED_GOAL
                    : ActivityType.UNLOCKED_ACHIEVEMENT;
            activityService.record( user, type, null, null, achievement.getTitle(), achievement.getDescription() );
        }

        return Stream.of( Achievement.values() )
                     .map( achievement -> AchievementResponse.builder()
                                                             .code( achievement.name() )
                                                             .title( achievement.getTitle() )
                                                             .description( achievement.getDescription() )
                                                             .unlocked( unlocked.containsKey( achievement ) )
                                                             .unlockedOn( unlocked.get( achievement ) )
                                                             .build() )
                     .toList();
    }

    private boolean isEarned( Achievement achievement, Snapshot snapshot ) {
        return switch ( achievement ) {
            case FIRST_ITEM -> snapshot.finished() >= 1;
            case TEN_ITEMS -> snapshot.finished() >= 10;
            case FIFTY_ITEMS -> snapshot.finished() >= 50;
            case HUNDRED_ITEMS -> snapshot.finished() >= 100;
            case WEEK_STREAK -> snapshot.longestStreak() >= 7;
            case MONTH_STREAK -> snapshot.longestStreak() >= 30;
            case REVIEWER -> snapshot.reviews() >= 10;
            case QUOTE_KEEPER -> snapshot.quotes() >= 50;
            case POLYGLOT -> snapshot.languages() >= 3;
            case OMNIVORE -> snapshot.kinds() >= 5;
            case GOAL_KEEPER -> snapshot.goalReached();
        };
    }

    private Snapshot snapshot( UUID userId ) {
        int year = LocalDate.now( clock ).getYear();
        return new Snapshot(
                libraryItemRepository.countFinishedBetween( userId, StreakService.EPOCH, StreakService.FAR_FUTURE ),
                streakService.forUser( userId ).getLongestStreak(),
                libraryItemRepository.countReviews( userId ),
                quoteRepository.countByOwner( userId ),
                libraryItemRepository.countDistinctLanguages( userId ),
                libraryItemRepository.countDistinctKinds( userId ),
                readingGoalService.isReached( userId, year )
        );
    }

    /** Код из БД мог остаться от удалённого достижения: такой просто игнорируется. */
    private Optional<Achievement> parse( String code ) {
        try {
            return Optional.of( Achievement.valueOf( code ) );
        } catch ( IllegalArgumentException ignored ) {
            return Optional.empty();
        }
    }

    /** Один срез статистики на все условия: считать его отдельно под каждое было бы расточительно. */
    private record Snapshot( long finished,
                             int longestStreak,
                             long reviews,
                             long quotes,
                             long languages,
                             long kinds,
                             boolean goalReached ) {

    }
}
