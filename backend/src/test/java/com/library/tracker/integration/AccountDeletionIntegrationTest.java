package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReadingSession;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Session;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserFollow;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Проверяет миграцию V18 против настоящей PostgreSQL: удаление пользователя должно уносить его
 * библиотеку и сессии каскадом.
 * <p>
 * До V18 внешние ключи {@code library_items.created_by} и {@code sessions.user_id} стояли без
 * каскада, и удаление аккаунта падало на нарушении ограничения. Такое ловится только на живой БД:
 * маппинг JPA об ограничениях внешних ключей ничего не знает.
 * <p>
 * Вторая половина проверки не менее важна первой: чужие данные удаление задевать не должно.
 */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class AccountDeletionIntegrationTest extends PostgresContainerTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private ReadingSessionRepository readingSessionRepository;

    @Autowired
    private QuoteRepository quoteRepository;

    @Autowired
    private ShelfRepository shelfRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private UserFollowRepository userFollowRepository;

    @Autowired
    private EntityManager entityManager;

    private User leaving;

    private User staying;

    private LibraryItem leavingItem;

    private LibraryItem stayingItem;

    @BeforeEach
    void setUp() {
        leaving = userRepository.save( user( "leaving" ) );
        staying = userRepository.save( user( "staying" ) );

        leavingItem = libraryItemRepository.save( item( leaving, "Задача трёх тел" ) );
        stayingItem = libraryItemRepository.save( item( staying, "Гиперион" ) );

        readingSessionRepository.save( session( leavingItem ) );
        readingSessionRepository.save( session( stayingItem ) );
        quoteRepository.save( quote( leavingItem ) );
        quoteRepository.save( quote( stayingItem ) );

        Tag tag = new Tag();
        tag.setOwner( leaving );
        tag.setName( "фантастика" );
        tagRepository.save( tag );

        Shelf shelf = new Shelf();
        shelf.setOwner( leaving );
        shelf.setName( "На лето" );
        shelf.setItems( new LinkedHashSet<>( Set.of( leavingItem ) ) );
        shelfRepository.save( shelf );

        // Полка остающегося пользователя с чужой записью: она уйдёт вместе с записью, а сама
        // полка должна уцелеть.
        Shelf sharedShelf = new Shelf();
        sharedShelf.setOwner( staying );
        sharedShelf.setName( "Советы" );
        sharedShelf.setItems( new LinkedHashSet<>( Set.of( leavingItem, stayingItem ) ) );
        shelfRepository.save( sharedShelf );

        UserFollow follow = new UserFollow();
        follow.setFollower( staying );
        follow.setFollowee( leaving );
        userFollowRepository.save( follow );

        Session activeSession = new Session();
        activeSession.setUser( leaving );
        activeSession.setExpiresAt( OffsetDateTime.now().plusHours( 1 ) );
        activeSession.setMaxExpiresAt( OffsetDateTime.now().plusHours( 8 ) );
        sessionRepository.save( activeSession );

        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void deletingUserRemovesEverythingThatBelongedToThem() {
        userRepository.deleteById( leaving.getId() );
        entityManager.flush();
        entityManager.clear();

        assertThat( userRepository.findById( leaving.getId() ) ).isEmpty();
        assertThat( libraryItemRepository.findById( leavingItem.getId() ) ).isEmpty();
        assertThat( readingSessionRepository.findByItemIdOrderBySessionDateDescCreatedAtDesc( leavingItem.getId() ) )
                .isEmpty();
        assertThat( quoteRepository.findByItemIdOrderByPositionAscCreatedAtAsc( leavingItem.getId() ) ).isEmpty();
        assertThat( tagRepository.findByOwnerIdOrderByNameAsc( leaving.getId() ) ).isEmpty();
        assertThat( shelfRepository.findByOwnerIdOrderByNameAsc( leaving.getId() ) ).isEmpty();
        assertThat( sessionRepository.findAll() ).isEmpty();
        assertThat( userFollowRepository.findAll() ).isEmpty();
    }

    @Test
    void deletingUserLeavesOtherPeopleAlone() {
        userRepository.deleteById( leaving.getId() );
        entityManager.flush();
        entityManager.clear();

        assertThat( userRepository.findById( staying.getId() ) ).isPresent();
        assertThat( libraryItemRepository.findById( stayingItem.getId() ) ).isPresent();
        assertThat( readingSessionRepository.findByItemIdOrderBySessionDateDescCreatedAtDesc( stayingItem.getId() ) )
                .hasSize( 1 );
        assertThat( quoteRepository.findByItemIdOrderByPositionAscCreatedAtAsc( stayingItem.getId() ) ).hasSize( 1 );

        // Общая полка уцелела, но чужая запись из неё ушла вместе с владельцем.
        List<Shelf> shelves = shelfRepository.findByOwnerIdOrderByNameAsc( staying.getId() );
        assertThat( shelves ).hasSize( 1 );
        assertThat( shelfRepository.findWithItemsById( shelves.getFirst().getId() ).orElseThrow().getItems() )
                .extracting( LibraryItem::getId )
                .containsExactly( stayingItem.getId() );
    }

    /** Ключи обложек нужны сервису до удаления: после каскада искать файлы в хранилище уже не по чему. */
    @Test
    void coverKeysAreListedPerOwner() {
        assertThat( libraryItemRepository.findCoverKeysByOwner( leaving.getId() ) )
                .containsExactly( "covers/leaving.jpg" );
        assertThat( libraryItemRepository.findCoverKeysByOwner( staying.getId() ) )
                .containsExactly( "covers/staying.jpg" );
    }

    private User user( String username ) {
        User user = new User();
        user.setUsername( username );
        user.setPassword( "$2a$10$hash" );
        user.setRole( Role.USER );
        return user;
    }

    private LibraryItem item( User owner, String title ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setCreatedBy( owner );
        item.setStatus( ReadingStatus.COMPLETED );
        item.setFinishedAt( LocalDate.of( 2026, 2, 3 ) );
        item.setCoverKey( "covers/" + owner.getUsername() + ".jpg" );
        return item;
    }

    private ReadingSession session( LibraryItem item ) {
        ReadingSession session = new ReadingSession();
        session.setItem( item );
        session.setSessionDate( LocalDate.of( 2026, 2, 1 ) );
        session.setDurationMinutes( 45 );
        return session;
    }

    private Quote quote( LibraryItem item ) {
        Quote quote = new Quote();
        quote.setItem( item );
        quote.setPosition( 100 );
        quote.setText( "Тёмный лес" );
        return quote;
    }
}
