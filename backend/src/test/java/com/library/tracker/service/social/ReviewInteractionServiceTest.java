package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReviewReaction;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ReviewCommentRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ReviewInteractionServiceTest {

    @Mock
    private ReviewReactionRepository reviewReactionRepository;

    @Mock
    private ReviewCommentRepository reviewCommentRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private UserService userService;

    @Mock
    private com.library.tracker.repository.UserFollowRepository userFollowRepository;

    private ReviewInteractionService service;

    private User reader;

    @BeforeEach
    void setUp() {
        ReviewAccess reviewAccess = new ReviewAccess( shelfRepository, userService );
        service = new ReviewInteractionService( reviewReactionRepository, reviewCommentRepository,
                                                libraryItemRepository, userService, reviewAccess,
                                                new ProfileMapper( userFollowRepository ) );
        reader = user( "reader" );
        lenient().when( userService.getCurrentUser() ).thenReturn( reader );
        lenient().when( userFollowRepository.findFolloweeIds( any() ) ).thenReturn( List.of() );
        lenient().when( reviewCommentRepository.findByItemIdOrderByCreatedAtAsc( any() ) ).thenReturn( List.of() );
        lenient().when( reviewReactionRepository.countByKind( any() ) ).thenReturn( List.of() );
    }

    /** Закрытый профиль без общей полки — это чужая карточка, и отзыва в ней нет. */
    @Test
    void reviewOfClosedProfileIsNotVisible() {
        LibraryItem item = item( user( "hermit" ), "Хороший роман", false );
        when( shelfRepository.existsReadableShelfWithItem( eq( item.getId() ), eq( reader.getId() ) ) )
                .thenReturn( false );

        assertThatThrownBy( () -> service.thread( item.getId() ) ).isInstanceOf( AccessDeniedException.class );
    }

    /** Общая полка открывает обсуждение, не открывая всю библиотеку владельца. */
    @Test
    void sharedShelfMakesReviewVisible() {
        LibraryItem item = item( user( "hermit" ), "Хороший роман", false );
        when( shelfRepository.existsReadableShelfWithItem( eq( item.getId() ), eq( reader.getId() ) ) )
                .thenReturn( true );

        assertThat( service.thread( item.getId() ).getItemId() ).isEqualTo( item.getId() );
    }

    /** Пустой отзыв обсуждать нечего, даже если профиль открыт: до полок дело не доходит. */
    @Test
    void itemWithoutReviewHasNothingToDiscuss() {
        LibraryItem item = item( user( "author" ), null, true );

        assertThatThrownBy( () -> service.thread( item.getId() ) ).isInstanceOf( AccessDeniedException.class );
        verify( shelfRepository, never() ).existsReadableShelfWithItem( any(), any() );
    }

    @Test
    void ownReviewCannotBeReactedTo() {
        LibraryItem item = item( reader, "Мой отзыв", true );

        assertThatThrownBy( () -> service.react( item.getId(), ReactionKind.LIKE ) )
                .isInstanceOf( IllegalArgumentException.class );
        verify( reviewReactionRepository, never() ).save( any( ReviewReaction.class ) );
    }

    /** Смена реакции правит строку, а не заводит вторую: иначе счётчик накручивался бы. */
    @Test
    void changingReactionReplacesTheExistingOne() {
        LibraryItem item = item( user( "author" ), "Хороший роман", true );
        ReviewReaction existing = new ReviewReaction();
        existing.setItem( item );
        existing.setUser( reader );
        existing.setKind( ReactionKind.LIKE );
        when( reviewReactionRepository.findByItemIdAndUserId( eq( item.getId() ), eq( reader.getId() ) ) )
                .thenReturn( Optional.of( existing ) );

        service.react( item.getId(), ReactionKind.DISAGREE );

        ArgumentCaptor<ReviewReaction> saved = ArgumentCaptor.forClass( ReviewReaction.class );
        verify( reviewReactionRepository ).save( saved.capture() );
        assertThat( saved.getValue() ).isSameAs( existing );
        assertThat( saved.getValue().getKind() ).isEqualTo( ReactionKind.DISAGREE );
    }

    @Test
    void commentIsTrimmedBeforeSaving() {
        LibraryItem item = item( user( "author" ), "Хороший роман", true );
        when( reviewReactionRepository.findByItemIdAndUserId( any(), any() ) ).thenReturn( Optional.empty() );

        ReviewCommentRequest request = new ReviewCommentRequest();
        request.setBody( "  Согласен  " );
        service.comment( item.getId(), request );

        ArgumentCaptor<com.library.tracker.domain.ReviewComment> saved =
                ArgumentCaptor.forClass( com.library.tracker.domain.ReviewComment.class );
        verify( reviewCommentRepository ).save( saved.capture() );
        assertThat( saved.getValue().getBody() ).isEqualTo( "Согласен" );
    }

    private LibraryItem item( User owner, String review, boolean publicProfile ) {
        owner.setPublicProfile( publicProfile );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Задача трёх тел" );
        item.setReview( review );
        item.setCreatedBy( owner );
        when( libraryItemRepository.findWithRelationsById( item.getId() ) ).thenReturn( Optional.of( item ) );
        return item;
    }

    private User user( String username ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        user.setRole( Role.USER );
        return user;
    }
}
