package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReviewComment;
import com.library.tracker.domain.ReviewReaction;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ReviewCommentRequest;
import com.library.tracker.web.dto.ReviewCommentResponse;
import com.library.tracker.web.dto.ReviewThreadResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Реакции и комментарии к отзывам. Реакция от человека одна: смена «полезно» на «не согласен» —
 * это правка строки, а не вторая отметка, иначе счётчик накручивался бы в самом очевидном месте.
 * <p>
 * Обсуждать можно только то, что и так видно, — правило целиком в {@link ReviewAccess}.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ReviewInteractionService {

    private final ReviewReactionRepository reviewReactionRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;
    private final ReviewAccess reviewAccess;
    private final ProfileMapper profileMapper;

    @Transactional( readOnly = true )
    public ReviewThreadResponse thread( UUID itemId ) {
        User currentUser = userService.getCurrentUser();
        return toThread( requireVisible( itemId, currentUser ), currentUser );
    }

    public ReviewThreadResponse react( UUID itemId, ReactionKind kind ) {
        User currentUser = userService.getCurrentUser();
        LibraryItem item = requireVisible( itemId, currentUser );
        // Реакция на собственный отзыв — это накрутка с нулевым смыслом, и запретить её дешевле,
        // чем потом объяснять счётчики.
        if ( reviewAccess.isOwner( item, currentUser ) ) {
            throw new IllegalArgumentException( "Свой отзыв отмечать реакцией нельзя" );
        }

        ReviewReaction reaction = reviewReactionRepository
                .findByItemIdAndUserId( itemId, currentUser.getId() )
                .orElseGet( () -> {
                    ReviewReaction created = new ReviewReaction();
                    created.setItem( item );
                    created.setUser( currentUser );
                    return created;
                } );
        reaction.setKind( kind );
        reviewReactionRepository.save( reaction );
        return toThread( item, currentUser );
    }

    public ReviewThreadResponse removeReaction( UUID itemId ) {
        User currentUser = userService.getCurrentUser();
        LibraryItem item = requireVisible( itemId, currentUser );
        reviewReactionRepository.findByItemIdAndUserId( itemId, currentUser.getId() )
                                .ifPresent( reviewReactionRepository::delete );
        return toThread( item, currentUser );
    }

    public ReviewThreadResponse comment( UUID itemId, ReviewCommentRequest request ) {
        User currentUser = userService.getCurrentUser();
        LibraryItem item = requireVisible( itemId, currentUser );

        ReviewComment comment = new ReviewComment();
        comment.setItem( item );
        comment.setAuthor( currentUser );
        comment.setBody( request.getBody().trim() );
        reviewCommentRepository.save( comment );
        return toThread( item, currentUser );
    }

    /** Своё удаляет автор, чужое — владелец отзыва и администратор: обсуждение идёт у него. */
    public ReviewThreadResponse deleteComment( UUID itemId, UUID commentId ) {
        User currentUser = userService.getCurrentUser();
        LibraryItem item = requireVisible( itemId, currentUser );

        reviewCommentRepository.findById( commentId )
                               .filter( comment -> comment.getItem().getId().equals( itemId ) )
                               .ifPresent( comment -> {
                                   if ( !canDelete( comment, item, currentUser ) ) {
                                       throw new AccessDeniedException( "Удалить можно только свой комментарий" );
                                   }
                                   reviewCommentRepository.delete( comment );
                               } );
        return toThread( item, currentUser );
    }

    private LibraryItem requireVisible( UUID itemId, User currentUser ) {
        LibraryItem item = libraryItemRepository.findWithRelationsById( itemId )
                                                .orElseThrow( () -> new IllegalArgumentException( "Книга не найдена" ) );
        if ( !reviewAccess.canSee( item, currentUser ) ) {
            throw new AccessDeniedException( "Этот отзыв вам не виден" );
        }
        return item;
    }

    private boolean canDelete( ReviewComment comment, LibraryItem item, User currentUser ) {
        return comment.getAuthor().getId().equals( currentUser.getId() )
               || reviewAccess.isOwner( item, currentUser )
               || userService.isAdmin( currentUser );
    }

    private ReviewThreadResponse toThread( LibraryItem item, User currentUser ) {
        Map<ReactionKind, Long> reactions = new EnumMap<>( ReactionKind.class );
        reviewReactionRepository.countByKind( item.getId() )
                                .forEach( row -> reactions.put( row.getKind(), row.getCount() ) );

        Set<UUID> followed = profileMapper.followedIds( currentUser );
        List<ReviewCommentResponse> comments = reviewCommentRepository
                .findByItemIdOrderByCreatedAtAsc( item.getId() )
                .stream()
                .map( comment -> ReviewCommentResponse.builder()
                                                      .id( comment.getId() )
                                                      .author( profileMapper.toSummary( comment.getAuthor(),
                                                                                        followed ) )
                                                      .body( comment.getBody() )
                                                      .createdAt( toOffsetDateTime( comment.getCreatedAt() ) )
                                                      .canDelete( canDelete( comment, item, currentUser ) )
                                                      .build() )
                .toList();

        return ReviewThreadResponse.builder()
                                   .itemId( item.getId() )
                                   .reactions( reactions )
                                   .myReaction( reviewReactionRepository
                                                        .findByItemIdAndUserId( item.getId(), currentUser.getId() )
                                                        .map( ReviewReaction::getKind )
                                                        .orElse( null ) )
                                   .comments( comments )
                                   .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
