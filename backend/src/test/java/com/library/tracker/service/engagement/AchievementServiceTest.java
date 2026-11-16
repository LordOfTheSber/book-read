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
import com.library.tracker.web.dto.StreakResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class AchievementServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed( Instant.parse( "2026-08-07T10:00:00Z" ), ZoneOffset.UTC );

    private static final LocalDate TODAY = LocalDate.of( 2026, 8, 7 );

    @Mock
    private UserAchievementRepository userAchievementRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private ReadingGoalService readingGoalService;

    @Mock
    private StreakService streakService;

    @Mock
    private ActivityService activityService;

    @Mock
    private UserService userService;

    private AchievementService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new AchievementService( userAchievementRepository, libraryItemRepository, quoteRepository,
                                          readingGoalService, streakService, activityService, userService,
                                          FIXED_CLOCK );
        owner = new User();
        owner.setId( UUID.randomUUID() );
        stats( 0, 0, 0, 0, 0, 0, false );
    }

    @Test
    void unlocksEarnedAchievementAndAnnouncesIt() {
        when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( owner.getId() ) ).thenReturn( List.of() );
        stats( 12, 0, 0, 0, 0, 0, false );

        List<AchievementResponse> responses = service.evaluate( owner );

        assertThat( byCode( responses, Achievement.FIRST_ITEM ).isUnlocked() ).isTrue();
        assertThat( byCode( responses, Achievement.TEN_ITEMS ).isUnlocked() ).isTrue();
        assertThat( byCode( responses, Achievement.TEN_ITEMS ).getUnlockedOn() ).isEqualTo( TODAY );
        // Пятьдесят ещё не набрано — закрытые тоже возвращаются, но серыми.
        assertThat( byCode( responses, Achievement.FIFTY_ITEMS ).isUnlocked() ).isFalse();

        verify( activityService ).record( eq( owner ), eq( ActivityType.UNLOCKED_ACHIEVEMENT ), isNull(), isNull(),
                                          eq( Achievement.FIRST_ITEM.getTitle() ), any() );
    }

    /** Повторная проверка не выдаёт то же самое второй раз и не сыплет событиями в ленту. */
    @Test
    void alreadyUnlockedIsNotAwardedAgain() {
        UserAchievement stored = new UserAchievement();
        stored.setOwner( owner );
        stored.setCode( Achievement.FIRST_ITEM.name() );
        stored.setUnlockedOn( TODAY.minusMonths( 3 ) );
        when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( owner.getId() ) )
                .thenReturn( List.of( stored ) );
        stats( 1, 0, 0, 0, 0, 0, false );

        List<AchievementResponse> responses = service.evaluate( owner );

        assertThat( byCode( responses, Achievement.FIRST_ITEM ).getUnlockedOn() ).isEqualTo( TODAY.minusMonths( 3 ) );
        verify( userAchievementRepository, never() ).save( any( UserAchievement.class ) );
        verify( activityService, never() ).record( any(), any(), any(), any(), any(), any() );
    }

    /** Взятая цель года попадает в ленту отдельным событием, а не как «ещё одна плашка». */
    @Test
    void reachedGoalIsAnnouncedAsItsOwnEvent() {
        when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( owner.getId() ) ).thenReturn( List.of() );
        stats( 0, 0, 0, 0, 0, 0, true );

        service.evaluate( owner );

        ArgumentCaptor<ActivityType> types = ArgumentCaptor.forClass( ActivityType.class );
        verify( activityService ).record( eq( owner ), types.capture(), isNull(), isNull(),
                                          eq( Achievement.GOAL_KEEPER.getTitle() ), any() );
        assertThat( types.getValue() ).isEqualTo( ActivityType.REACHED_GOAL );
    }

    /** Код от удалённого достижения не должен ронять страницу. */
    @Test
    void unknownStoredCodeIsIgnored() {
        UserAchievement stale = new UserAchievement();
        stale.setOwner( owner );
        stale.setCode( "LEGACY_BADGE" );
        stale.setUnlockedOn( TODAY.minusYears( 1 ) );
        when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( owner.getId() ) )
                .thenReturn( List.of( stale ) );

        List<AchievementResponse> responses = service.evaluate( owner );

        assertThat( responses ).hasSize( Achievement.values().length );
        assertThat( responses ).noneMatch( AchievementResponse::isUnlocked );
    }

    private void stats( long finished, int streak, long reviews, long quotes, long languages, long kinds,
                        boolean goalReached ) {
        lenient().when( libraryItemRepository.countFinishedBetween( eq( owner.getId() ), any(), any() ) )
                 .thenReturn( finished );
        lenient().when( streakService.forUser( owner.getId() ) )
                 .thenReturn( StreakResponse.builder().longestStreak( streak ).recentDays( List.of() ).build() );
        lenient().when( libraryItemRepository.countReviews( owner.getId() ) ).thenReturn( reviews );
        lenient().when( quoteRepository.countByOwner( owner.getId() ) ).thenReturn( quotes );
        lenient().when( libraryItemRepository.countDistinctLanguages( owner.getId() ) ).thenReturn( languages );
        lenient().when( libraryItemRepository.countDistinctKinds( owner.getId() ) ).thenReturn( kinds );
        lenient().when( readingGoalService.isReached( eq( owner.getId() ), anyInt() ) ).thenReturn( goalReached );
    }

    private AchievementResponse byCode( List<AchievementResponse> responses, Achievement achievement ) {
        return responses.stream()
                        .filter( response -> response.getCode().equals( achievement.name() ) )
                        .findFirst()
                        .orElseThrow();
    }
}
