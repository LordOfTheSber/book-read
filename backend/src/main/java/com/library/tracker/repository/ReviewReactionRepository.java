package com.library.tracker.repository;

import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReviewReaction;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReviewReactionRepository extends JpaRepository<ReviewReaction, UUID> {

    Optional<ReviewReaction> findByItemIdAndUserId( UUID itemId, UUID userId );

    List<ReviewReaction> findByItemId( UUID itemId );

    /** Счётчики по видам для одного отзыва: строк здесь столько же, сколько видов реакций. */
    @Query( """
            select r.kind as kind, count(r) as count
            from ReviewReaction r
            where r.item.id = :itemId
            group by r.kind
            """ )
    List<KindCount> countByKind( UUID itemId );

    /** Свои отметки на списке отзывов: лента должна знать, где сердце уже нажато. */
    @Query( """
            select r
            from ReviewReaction r
            where r.item.id in :itemIds
              and r.user.id = :userId
            """ )
    List<ReviewReaction> findMineByItems( Collection<UUID> itemIds, UUID userId );

    /** Счётчики для списка отзывов — одним запросом на список, а не по запросу на строку. */
    @Query( """
            select r.item.id as itemId, count(r) as count
            from ReviewReaction r
            where r.item.id in :itemIds
            group by r.item.id
            """ )
    List<ItemCount> countByItem( Collection<UUID> itemIds );

    interface KindCount {

        ReactionKind getKind();

        long getCount();
    }

    interface ItemCount {

        UUID getItemId();

        long getCount();
    }
}
