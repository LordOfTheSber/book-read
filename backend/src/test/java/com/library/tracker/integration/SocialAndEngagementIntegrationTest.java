package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.ActivityEvent;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Loan;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReadingGoal;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.ReviewReaction;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.ShelfRole;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserAchievement;
import com.library.tracker.domain.UserFollow;
import com.library.tracker.repository.ActivityEventRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Проверяет миграции V15 и V16 против маппинга на настоящей PostgreSQL: подписки, лента, реакции,
 * участники полок, выдачи, цели и достижения. Заодно проверяются запросы, которые без Postgres
 * проверить нечем, — прежде всего видимость отзыва через общую полку.
 */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class SocialAndEngagementIntegrationTest extends PostgresContainerTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserFollowRepository userFollowRepository;

    @Autowired
    private ActivityEventRepository activityEventRepository;

    @Autowired
    private ReviewReactionRepository reviewReactionRepository;

    @Autowired
    private ShelfRepository shelfRepository;

    @Autowired
    private ShelfMemberRepository shelfMemberRepository;

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private ReadingGoalRepository readingGoalRepository;

    @Autowired
    private UserAchievementRepository userAchievementRepository;

    private User owner;

    private User reader;

    @BeforeEach
    void setUp() {
        owner = userRepository.saveAndFlush( user( "owner-" + UUID.randomUUID(), true ) );
        reader = userRepository.saveAndFlush( user( "reader-" + UUID.randomUUID(), true ) );
    }

    @Test
    void followsAreUniquePerPair() {
        userFollowRepository.saveAndFlush( follow( reader, owner ) );

        assertThatThrownBy( () -> userFollowRepository.saveAndFlush( follow( reader, owner ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    /** Подписка на себя ничего не добавляет, и это закреплено ограничением, а не только кодом. */
    @Test
    void followingSelfIsRejectedByConstraint() {
        assertThatThrownBy( () -> userFollowRepository.saveAndFlush( follow( reader, reader ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void feedReturnsOnlyRequestedActorsNewestFirst() {
        activityEventRepository.saveAndFlush( event( owner, "Задача трёх тел" ) );
        activityEventRepository.saveAndFlush( event( owner, "Тёмный лес" ) );
        activityEventRepository.saveAndFlush( event( reader, "Чужое" ) );

        List<ActivityEvent> feed = activityEventRepository.findByActorIdInOrderByCreatedAtDesc(
                Set.of( owner.getId() ), PageRequest.of( 0, 10 ) );

        assertThat( feed ).hasSize( 2 );
        assertThat( feed ).allMatch( item -> item.getActor().getId().equals( owner.getId() ) );
    }

    /** Закрытый профиль выпадает из ленты целиком — фильтр стоит до среза, а не после. */
    @Test
    void publicProfileFilterSkipsClosedAccounts() {
        User hermit = userRepository.saveAndFlush( user( "hermit-" + UUID.randomUUID(), false ) );

        List<UUID> visible = userRepository.findPublicProfileIds( List.of( owner.getId(), hermit.getId() ) );

        assertThat( visible ).containsExactly( owner.getId() );
    }

    @Test
    void reactionIsOnePerUserAndItem() {
        LibraryItem item = libraryItemRepository.saveAndFlush( item( owner, "Задача трёх тел" ) );
        reviewReactionRepository.saveAndFlush( reaction( item, reader, ReactionKind.LIKE ) );

        assertThatThrownBy( () -> reviewReactionRepository
                .saveAndFlush( reaction( item, reader, ReactionKind.DISAGREE ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    /**
     * Общая полка открывает обсуждение отзыва, не открывая всю библиотеку владельца, — это тот
     * самый запрос, ради которого правило видимости собрано в одном месте.
     */
    @Test
    void sharedShelfExposesItemToItsMembers() {
        LibraryItem item = libraryItemRepository.saveAndFlush( item( owner, "Задача трёх тел" ) );
        Shelf shelf = new Shelf();
        shelf.setOwner( owner );
        shelf.setName( "Книжный клуб " + UUID.randomUUID() );
        shelf.setItems( new LinkedHashSet<>( List.of( item ) ) );
        shelfRepository.saveAndFlush( shelf );

        assertThat( shelfRepository.existsReadableShelfWithItem( item.getId(), reader.getId() ) ).isFalse();

        ShelfMember member = new ShelfMember();
        member.setShelf( shelf );
        member.setUser( reader );
        member.setRole( ShelfRole.CONTRIBUTOR );
        shelfMemberRepository.saveAndFlush( member );

        assertThat( shelfRepository.existsReadableShelfWithItem( item.getId(), reader.getId() ) ).isTrue();
    }

    @Test
    void publicShelfExposesItemToEveryone() {
        LibraryItem item = libraryItemRepository.saveAndFlush( item( owner, "Тёмный лес" ) );
        Shelf shelf = new Shelf();
        shelf.setOwner( owner );
        shelf.setName( "Витрина " + UUID.randomUUID() );
        shelf.setPublic( true );
        shelf.setItems( new LinkedHashSet<>( List.of( item ) ) );
        shelfRepository.saveAndFlush( shelf );

        assertThat( shelfRepository.existsReadableShelfWithItem( item.getId(), reader.getId() ) ).isTrue();
    }

    @Test
    void memberIsUniquePerShelf() {
        Shelf shelf = new Shelf();
        shelf.setOwner( owner );
        shelf.setName( "Семейная " + UUID.randomUUID() );
        shelfRepository.saveAndFlush( shelf );

        shelfMemberRepository.saveAndFlush( member( shelf, reader, ShelfRole.VIEWER ) );

        assertThatThrownBy( () -> shelfMemberRepository.saveAndFlush( member( shelf, reader, ShelfRole.CURATOR ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void openLoansAreScopedToOwnerAndOrderedByDueDate() {
        LibraryItem lent = libraryItemRepository.saveAndFlush( item( owner, "Задача трёх тел" ) );
        LibraryItem returned = libraryItemRepository.saveAndFlush( item( owner, "Тёмный лес" ) );
        LibraryItem foreign = libraryItemRepository.saveAndFlush( item( reader, "Чужое" ) );

        loanRepository.saveAndFlush( loan( lent, LocalDate.now().minusDays( 30 ),
                                           LocalDate.now().minusDays( 3 ), null ) );
        loanRepository.saveAndFlush( loan( returned, LocalDate.now().minusDays( 40 ), null,
                                           LocalDate.now().minusDays( 1 ) ) );
        loanRepository.saveAndFlush( loan( foreign, LocalDate.now().minusDays( 5 ), null, null ) );

        List<Loan> open = loanRepository.findOpen( owner.getId() );

        assertThat( open ).hasSize( 1 );
        assertThat( open.get( 0 ).getItem().getId() ).isEqualTo( lent.getId() );
        assertThat( loanRepository.existsOpenForItem( lent.getId() ) ).isTrue();
        assertThat( loanRepository.existsOpenForItem( returned.getId() ) ).isFalse();
        assertThat( loanRepository.countOverdue( owner.getId(), LocalDate.now() ) ).isEqualTo( 1 );
    }

    /** Возврат раньше выдачи — это опечатка, и её ловит сама схема. */
    @Test
    void returnBeforeLendingIsRejected() {
        LibraryItem item = libraryItemRepository.saveAndFlush( item( owner, "Задача трёх тел" ) );
        Loan broken = loan( item, LocalDate.now(), null, LocalDate.now().minusDays( 5 ) );

        assertThatThrownBy( () -> loanRepository.saveAndFlush( broken ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void goalIsUniquePerOwnerAndYear() {
        readingGoalRepository.saveAndFlush( goal( owner, 2026, 40 ) );

        assertThatThrownBy( () -> readingGoalRepository.saveAndFlush( goal( owner, 2026, 50 ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void achievementIsAwardedOnce() {
        userAchievementRepository.saveAndFlush( achievement( owner, "FIRST_ITEM" ) );

        assertThatThrownBy( () -> userAchievementRepository.saveAndFlush( achievement( owner, "FIRST_ITEM" ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    /** Срезы, на которых стоят цель, стрик и «Год в обзоре». */
    @Test
    void finishedItemsAreCountedWithinTheYear() {
        LibraryItem inYear = item( owner, "Задача трёх тел" );
        inYear.setFinishedAt( LocalDate.of( 2026, 3, 14 ) );
        inYear.setPageCount( 400 );
        inYear.setStatus( ReadingStatus.COMPLETED );
        libraryItemRepository.saveAndFlush( inYear );

        LibraryItem earlier = item( owner, "Тёмный лес" );
        earlier.setFinishedAt( LocalDate.of( 2025, 12, 31 ) );
        earlier.setPageCount( 600 );
        libraryItemRepository.saveAndFlush( earlier );

        LocalDate from = LocalDate.of( 2026, 1, 1 );
        LocalDate to = LocalDate.of( 2026, 12, 31 );

        assertThat( libraryItemRepository.countFinishedBetween( owner.getId(), from, to ) ).isEqualTo( 1 );
        assertThat( libraryItemRepository.sumPagesFinishedBetween( owner.getId(), from, to ) ).isEqualTo( 400 );
        assertThat( libraryItemRepository.findFinishedBetween( owner.getId(), from, to ) )
                .extracting( LibraryItem::getTitle )
                .containsExactly( "Задача трёх тел" );
    }

    /** Отзывы для профиля: запись без отзыва в выдачу не попадает. */
    @Test
    void reviewedItemsSkipEmptyReviews() {
        LibraryItem reviewed = item( owner, "Задача трёх тел" );
        reviewed.setReview( "Отличная научная фантастика" );
        libraryItemRepository.saveAndFlush( reviewed );

        LibraryItem blank = item( owner, "Тёмный лес" );
        blank.setReview( "   " );
        libraryItemRepository.saveAndFlush( blank );

        assertThat( libraryItemRepository.findReviewed( owner.getId(), PageRequest.of( 0, 10 ) ) )
                .extracting( LibraryItem::getTitle )
                .containsExactly( "Задача трёх тел" );
        assertThat( libraryItemRepository.countReviews( owner.getId() ) ).isEqualTo( 1 );
    }

    private User user( String username, boolean publicProfile ) {
        User user = new User();
        user.setUsername( username );
        user.setPassword( "secret" );
        user.setRole( Role.USER );
        user.setPublicProfile( publicProfile );
        return user;
    }

    private UserFollow follow( User follower, User followee ) {
        UserFollow follow = new UserFollow();
        follow.setFollower( follower );
        follow.setFollowee( followee );
        return follow;
    }

    private ActivityEvent event( User actor, String subject ) {
        ActivityEvent event = new ActivityEvent();
        event.setActor( actor );
        event.setType( ActivityType.FINISHED_READING );
        event.setSubject( subject );
        return event;
    }

    private ReviewReaction reaction( LibraryItem item, User user, ReactionKind kind ) {
        ReviewReaction reaction = new ReviewReaction();
        reaction.setItem( item );
        reaction.setUser( user );
        reaction.setKind( kind );
        return reaction;
    }

    private ShelfMember member( Shelf shelf, User user, ShelfRole role ) {
        ShelfMember member = new ShelfMember();
        member.setShelf( shelf );
        member.setUser( user );
        member.setRole( role );
        return member;
    }

    private Loan loan( LibraryItem item, LocalDate lentOn, LocalDate dueOn, LocalDate returnedOn ) {
        Loan loan = new Loan();
        loan.setItem( item );
        loan.setBorrowerName( "Аня" );
        loan.setLentOn( lentOn );
        loan.setDueOn( dueOn );
        loan.setReturnedOn( returnedOn );
        return loan;
    }

    private ReadingGoal goal( User user, int year, int targetItems ) {
        ReadingGoal goal = new ReadingGoal();
        goal.setOwner( user );
        goal.setYear( year );
        goal.setTargetItems( targetItems );
        return goal;
    }

    private UserAchievement achievement( User user, String code ) {
        UserAchievement achievement = new UserAchievement();
        achievement.setOwner( user );
        achievement.setCode( code );
        achievement.setUnlockedOn( LocalDate.now() );
        return achievement;
    }

    private LibraryItem item( User createdBy, String title ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setCreatedBy( createdBy );
        item.setStatus( ReadingStatus.PLANNED );
        return item;
    }
}
