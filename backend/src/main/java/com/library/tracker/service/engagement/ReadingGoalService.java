package com.library.tracker.service.engagement;

import com.library.tracker.domain.ReadingGoal;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.GoalMetricResponse;
import com.library.tracker.web.dto.ReadingGoalRequest;
import com.library.tracker.web.dto.ReadingGoalResponse;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.stream.Stream;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Челлендж года. Хранятся только цифры цели: прогресс считается по библиотеке и заходам, а не
 * копится в колонке — иначе удаление записи навсегда оставило бы счётчик завышенным.
 * <p>
 * Главное здесь не проценты, а отставание от равномерного темпа: «12 из 40» в июне и в декабре —
 * совершенно разные положения дел, и без графика цифра ни о чём не говорит.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ReadingGoalService {

    private final ReadingGoalRepository readingGoalRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final UserService userService;
    private final Clock clock;

    @Transactional( readOnly = true )
    public ReadingGoalResponse find( Integer year ) {
        User currentUser = userService.getCurrentUser();
        int targetYear = year != null ? year : LocalDate.now( clock ).getYear();
        return toResponse( currentUser.getId(),
                           targetYear,
                           readingGoalRepository.findByOwnerIdAndYear( currentUser.getId(), targetYear ).orElse( null ) );
    }

    @Transactional( readOnly = true )
    public List<ReadingGoalResponse> findAll() {
        User currentUser = userService.getCurrentUser();
        return readingGoalRepository.findByOwnerIdOrderByYearDesc( currentUser.getId() ).stream()
                                    .map( goal -> toResponse( currentUser.getId(), goal.getYear(), goal ) )
                                    .toList();
    }

    /** Цель заводится и правится одним вызовом: у пользователя на год она ровно одна. */
    public ReadingGoalResponse save( Integer year, ReadingGoalRequest request ) {
        User currentUser = userService.getCurrentUser();
        int targetYear = year != null ? year : LocalDate.now( clock ).getYear();

        // Пустой запрос — это отказ от цели, а не цель из трёх пустот: строка со всеми null
        // ничего не значит и только мешала бы отличить «не загадывал» от «загадал ничего».
        if ( request.getTargetItems() == null && request.getTargetPages() == null
             && request.getTargetMinutes() == null ) {
            delete( targetYear );
            return toResponse( currentUser.getId(), targetYear, null );
        }

        ReadingGoal goal = readingGoalRepository.findByOwnerIdAndYear( currentUser.getId(), targetYear )
                                                .orElseGet( () -> {
                                                    ReadingGoal created = new ReadingGoal();
                                                    created.setOwner( currentUser );
                                                    created.setYear( targetYear );
                                                    return created;
                                                } );
        goal.setTargetItems( request.getTargetItems() );
        goal.setTargetPages( request.getTargetPages() );
        goal.setTargetMinutes( request.getTargetMinutes() );
        return toResponse( currentUser.getId(), targetYear, readingGoalRepository.save( goal ) );
    }

    public void delete( int year ) {
        User currentUser = userService.getCurrentUser();
        readingGoalRepository.findByOwnerIdAndYear( currentUser.getId(), year )
                             .ifPresent( readingGoalRepository::delete );
    }

    /** Достигнута ли цель года: нужно достижению «Цель взята» и событию в ленте. */
    @Transactional( readOnly = true )
    public boolean isReached( UUID userId, int year ) {
        return readingGoalRepository.findByOwnerIdAndYear( userId, year )
                                    .map( goal -> toResponse( userId, year, goal ).isCompleted() )
                                    .orElse( false );
    }

    private ReadingGoalResponse toResponse( UUID userId, int year, ReadingGoal goal ) {
        LocalDate from = LocalDate.of( year, 1, 1 );
        LocalDate to = from.withDayOfYear( from.lengthOfYear() );
        LocalDate today = LocalDate.now( clock );

        int daysInYear = from.lengthOfYear();
        // Прошедшая часть года: у минувшего года она вся, у будущего — ни дня.
        int daysPassed = today.getYear() > year ? daysInYear
                : today.getYear() < year ? 0
                        : today.getDayOfYear();

        GoalMetricResponse items = metric( goal != null ? goal.getTargetItems() : null,
                                           () -> libraryItemRepository.countFinishedBetween( userId, from, to ),
                                           daysPassed, daysInYear );
        GoalMetricResponse pages = metric( goal != null ? goal.getTargetPages() : null,
                                           () -> libraryItemRepository.sumPagesFinishedBetween( userId, from, to ),
                                           daysPassed, daysInYear );
        GoalMetricResponse minutes = metric( goal != null ? goal.getTargetMinutes() : null,
                                             () -> readingSessionRepository.sumMinutes( userId, from, to ),
                                             daysPassed, daysInYear );

        List<GoalMetricResponse> configured = Stream.of( items, pages, minutes )
                                                    .filter( Objects::nonNull )
                                                    .toList();

        return ReadingGoalResponse.builder()
                                  .year( year )
                                  .configured( !configured.isEmpty() )
                                  .items( items )
                                  .pages( pages )
                                  .minutes( minutes )
                                  .daysPassed( daysPassed )
                                  .daysLeft( daysInYear - daysPassed )
                                  .completed( !configured.isEmpty()
                                              && configured.stream().allMatch( m -> m.getDone() >= m.getTarget() ) )
                                  .build();
    }

    /**
     * Незаведённая цель не считается вовсе: считать прогресс к нулю значило бы делить на ноль,
     * а показывать «выполнено» тому, кто ничего не загадывал, — врать.
     */
    private GoalMetricResponse metric( Integer target, LongSupplier done, int daysPassed, int daysInYear ) {
        if ( target == null || target <= 0 ) {
            return null;
        }
        long achieved = done.getAsLong();
        long expected = (long) Math.floor( (double) target * daysPassed / daysInYear );
        long projected = daysPassed > 0 ? Math.round( (double) achieved * daysInYear / daysPassed ) : 0;

        return GoalMetricResponse.builder()
                                 .target( target )
                                 .done( achieved )
                                 .expected( expected )
                                 .percent( (int) Math.min( 100, achieved * 100 / target ) )
                                 .behind( Math.max( 0, expected - achieved ) )
                                 .onTrack( achieved >= expected )
                                 .projected( projected )
                                 .build();
    }
}
