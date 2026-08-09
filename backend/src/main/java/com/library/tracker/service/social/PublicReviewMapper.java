package com.library.tracker.service.social;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.web.dto.PublicReviewResponse;

import java.util.List;
import java.util.Map;
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
 * из десяти отзывов стоил бы двадцати обращений к базе.
 */
@Component
@RequiredArgsConstructor
public class PublicReviewMapper {

    private final ReviewReactionRepository reviewReactionRepository;
    private final ReviewCommentRepository reviewCommentRepository;

    @Transactional( readOnly = true )
    public List<PublicReviewResponse> toResponses( List<LibraryItem> items ) {
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

        return items.stream()
                    .map( item -> toResponse( item,
                                              reactions.getOrDefault( item.getId(), 0L ),
                                              comments.getOrDefault( item.getId(), 0L ) ) )
                    .toList();
    }

    public PublicReviewResponse toResponse( LibraryItem item, long reactionCount, long commentCount ) {
        return PublicReviewResponse.builder()
                                   .itemId( item.getId() )
                                   .kind( item.getKind() )
                                   .title( item.getTitle() )
                                   .authorNames( item.getAuthors().stream()
                                                     .map( Author::getName )
                                                     .sorted( String.CASE_INSENSITIVE_ORDER )
                                                     .toList() )
                                   .hasCover( item.getCoverKey() != null )
                                   .rating( item.getRating() )
                                   .review( item.getReview() )
                                   .reviewSpoiler( item.getReviewSpoiler() )
                                   .finishedAt( item.getFinishedAt() )
                                   .reactionCount( reactionCount )
                                   .commentCount( commentCount )
                                   .build();
    }
}
