package com.library.tracker.service.engagement;

import com.library.tracker.domain.ReadingGoal;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ReadingGoalRequest;
import com.library.tracker.web.dto.ReadingGoalResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Первое июля високосного 2028-го — ровно середина года, на ней проще всего проверять график. */
@ExtendWith( MockitoExtension.class )
class ReadingGoalServiceTest {

    private static final int YEAR = 2028;

    private static final int DAYS_IN_YEAR = 366;

    /** 183-й день из 366: половина года позади. */
    private static final Clock MID_YEAR = Clock.fixed( Instant.parse( "2028-07-01T12:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private ReadingGoalRepository readingGoalRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private ReadingSessionRepository readingSessionRepository;

    @Mock
    private UserService userService;

    private ReadingGoalService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new ReadingGoalService( readingGoalRepository, libraryItemRepository, readingSessionRepository,
                                          userService, MID_YEAR );
        owner = new User();
        owner.setId( UUID.randomUUID() );
        lenient().when( userService.getCurrentUser() ).thenReturn( owner );
    }

    @Test
    void behindScheduleIsMeasuredAgainstEvenPace() {
        goal( 40, null, null );
        finished( 12 );

        ReadingGoalResponse response = service.find( YEAR );

        // Половина года прошла, значит по графику полагалось бы двадцать.
        assertThat( response.getItems().getExpected() ).isEqualTo( 20 );
        assertThat( response.getItems().getBehind() ).isEqualTo( 8 );
        assertThat( response.getItems().isOnTrack() ).isFalse();
        assertThat( response.getItems().getPercent() ).isEqualTo( 30 );
        assertThat( response.getDaysLeft() ).isEqualTo( DAYS_IN_YEAR - 183 );
    }

    /** Опережение отдаётся нулём: отрицательное отставание пришлось бы объяснять в интерфейсе. */
    @Test
    void aheadOfScheduleReportsZeroBehind() {
        goal( 40, null, null );
        finished( 30 );

        ReadingGoalResponse response = service.find( YEAR );

        assertThat( response.getItems().isOnTrack() ).isTrue();
        assertThat( response.getItems().getBehind() ).isZero();
        assertThat( response.getItems().getProjected() ).isEqualTo( 60 );
    }

    /** Незаведённая цель не считается вовсе — иначе делили бы на ноль и врали бы «выполнено». */
    @Test
    void missingGoalHasNoMetrics() {
        when( readingGoalRepository.findByOwnerIdAndYear( eq( owner.getId() ), eq( YEAR ) ) )
                .thenReturn( Optional.empty() );

        ReadingGoalResponse response = service.find( YEAR );

        assertThat( response.isConfigured() ).isFalse();
        assertThat( response.getItems() ).isNull();
        assertThat( response.isCompleted() ).isFalse();
    }

    @Test
    void completedRequiresEveryConfiguredTarget() {
        goal( 10, 3000, null );
        finished( 12 );
        when( libraryItemRepository.sumPagesFinishedBetween( eq( owner.getId() ), any(), any() ) ).thenReturn( 1200L );

        assertThat( service.find( YEAR ).isCompleted() ).isFalse();

        when( libraryItemRepository.sumPagesFinishedBetween( eq( owner.getId() ), any(), any() ) ).thenReturn( 3400L );

        assertThat( service.find( YEAR ).isCompleted() ).isTrue();
    }

    /** У минувшего года график считается целиком: отставание в нём уже не догнать. */
    @Test
    void pastYearCountsWholeYearAsPassed() {
        ReadingGoal goal = goal( 40, null, null );
        goal.setYear( YEAR - 1 );
        when( readingGoalRepository.findByOwnerIdAndYear( eq( owner.getId() ), eq( YEAR - 1 ) ) )
                .thenReturn( Optional.of( goal ) );
        when( libraryItemRepository.countFinishedBetween( eq( owner.getId() ), any(), any() ) ).thenReturn( 12L );

        ReadingGoalResponse response = service.find( YEAR - 1 );

        assertThat( response.getItems().getExpected() ).isEqualTo( 40 );
        assertThat( response.getDaysLeft() ).isZero();
    }

    /** Очистить все поля и нажать «Сохранить» — это отказ от цели, а не цель из трёх пустот. */
    @Test
    void savingEmptyTargetsRemovesTheGoal() {
        ReadingGoal existing = goal( 40, null, null );

        ReadingGoalRequest request = new ReadingGoalRequest();
        ReadingGoalResponse response = service.save( YEAR, request );

        verify( readingGoalRepository ).delete( existing );
        verify( readingGoalRepository, never() ).save( any( ReadingGoal.class ) );
        assertThat( response.isConfigured() ).isFalse();
    }

    private ReadingGoal goal( Integer items, Integer pages, Integer minutes ) {
        ReadingGoal goal = new ReadingGoal();
        goal.setOwner( owner );
        goal.setYear( YEAR );
        goal.setTargetItems( items );
        goal.setTargetPages( pages );
        goal.setTargetMinutes( minutes );
        lenient().when( readingGoalRepository.findByOwnerIdAndYear( eq( owner.getId() ), eq( YEAR ) ) )
                 .thenReturn( Optional.of( goal ) );
        return goal;
    }

    private void finished( long count ) {
        lenient().when( libraryItemRepository.countFinishedBetween( eq( owner.getId() ), any(), any() ) )
                 .thenReturn( count );
    }
}
