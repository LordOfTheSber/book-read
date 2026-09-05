package com.library.tracker.service.social;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReviewReaction;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.PublicReviewResponse;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Отзыв в том виде, в каком его можно показать другому пользователю. Набор полей ограничен по
 * построению: приватная заметка сюда не попадает, а спойлерная часть отдаётся отдельным полем,
 * чтобы клиент спрятал её под кат, а не разбирал разметку.
 * <p>
 * Счётчики реакций и комментариев берутся одним запросом на список: по запросу на строку список
 * из десяти отзывов стоил бы двадцати обращений к базе. Тем же запросом приходят и свои отметки —
 * без них лента не знает, нажато сердце или нет, и рисовала бы его пустым поверх своей реакции.
 */
@Component
@RequiredArgsConstructor
public class PublicReviewMapper {

    private final ReviewReactionRepository reviewReactionRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<PublicReviewResponse> toResponses( List<LibraryItem> items ) {
        return toResponses( items, Set.of() );
    }

    /**
     * То же со списком названий из библиотеки спрашивающего: по нему ставится отметка «есть у вас».
     * Названия приходят готовым множеством, а не запросом на строку: библиотека у каждого своя,
     * и «та же книга» — это совпадение названия, а не идентификатора.
     */
    @Transactional( readOnly = true )
    public List<PublicReviewResponse> toResponses( List<LibraryItem> items, Set<String> ownedTitles ) {
        if ( items.isEmpty() ) {
            return List.of();
        }
        List<UUID> ids = items.stream().map( LibraryItem::getId ).toList();
        Map<UUID, Long> reactions = reviewReactionRepository.countByItem( ids ).stream()
                                                            .collect( Collectors.toMap(
                                                                    ReviewReactionRepository.ItemCount::getItemId,
                                                                    ReviewReactionRepository.ItemCount::getCount ) );
        Map<UUID, Long> comments = reviewCommentRepository.countByItem( ids ).stream()
                                                          .collect( Collectors.toMap(
                                                                  ReviewCommentRepository.ItemCount::getItemId,
                                                                  ReviewCommentRepository.ItemCount::getCount ) );
        Map<UUID, ReactionKind> mine = myReactions( ids );

        return items.stream()
                    .map( item -> toResponse( item,
                                              reactions.getOrDefault( item.getId(), 0L ),
                                              comments.getOrDefault( item.getId(), 0L ),
                                              mine.get( item.getId() ),
                                              ownedTitles.contains( normalizeTitle( item.getTitle() ) ) ) )
                    .toList();
    }

    public PublicReviewResponse toResponse( LibraryItem item, long reactionCount, long commentCount ) {
        return toResponse( item, reactionCount, commentCount, null, false );
    }

    public PublicReviewResponse toResponse( LibraryItem item, long reactionCount, long commentCount,
                                            ReactionKind myReaction ) {
        return toResponse( item, reactionCount, commentCount, myReaction, false );
    }

    /** Названия сравниваются в нижнем регистре: «Дюна» и «дюна» — одна и та же книга. */
    public static String normalizeTitle( String title ) {
        return title == null ? "" : title.trim().toLowerCase( Locale.ROOT );
    }

    private PublicReviewResponse toResponse( LibraryItem item, long reactionCount, long commentCount,
                                             ReactionKind myReaction, boolean inMyLibrary ) {
        return PublicReviewResponse.builder()
                                   .itemId( item.getId() )
                                   .kind( item.getKind() )
                                   .title( item.getTitle() )
                                   .authorNames( item.getAuthors().stream()
                                                     .map( Author::getName )
                                                     .sorted( String.CASE_INSENSITIVE_ORDER )
                                                     .toList() )
                                   .publishedYear( item.getPublishedYear() )
                                   .pageCount( item.getPageCount() )
                                   .hasCover( item.getCoverKey() != null )
                                   .rating( item.getRating() )
                                   .review( item.getReview() )
                                   .reviewSpoiler( item.getReviewSpoiler() )
                                   .finishedAt( item.getFinishedAt() )
                                   .reactionCount( reactionCount )
                                   .commentCount( commentCount )
                                   .myReaction( myReaction )
                                   .inMyLibrary( inMyLibrary )
                                   .build();
    }

    private Map<UUID, ReactionKind> myReactions( List<UUID> ids ) {
        User currentUser = userService.getCurrentUser();
        if ( currentUser == null ) {
            return Map.of();
        }
        Map<UUID, ReactionKind> mine = new HashMap<>();
        for ( ReviewReaction reaction : reviewReactionRepository.findMineByItems( ids, currentUser.getId() ) ) {
            mine.put( reaction.getItem().getId(), reaction.getKind() );
        }
        return mine;
    }
}
