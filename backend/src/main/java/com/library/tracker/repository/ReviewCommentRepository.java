package com.library.tracker.repository;

import com.library.tracker.domain.ReviewComment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReviewCommentRepository extends JpaRepository<ReviewComment, UUID> {

    @EntityGraph( attributePaths = { "author" } )
    List<ReviewComment> findByItemIdOrderByCreatedAtAsc( UUID itemId );

    long countByItemId( UUID itemId );

    /** Счётчики для списка отзывов — одним запросом на список. */
    @Query( """
            select c.item.id as itemId, count(c) as count
            from ReviewComment c
            where c.item.id in :itemIds
            group by c.item.id
            """ )
    List<ItemCount> countByItem( Collection<UUID> itemIds );

    /**
     * Сколько обсуждали за отрезок. Владелец записи проверяется здесь же: чужой комментарий
     * не должен вытаскивать в сводку книгу из закрытого профиля.
     */
    @Query( """
            select c.item.id as itemId, count(c) as count
            from ReviewComment c
            where c.item.createdBy.id in :ownerIds
              and c.createdAt >= :since
            group by c.item.id
            """ )
    List<ItemCount> countSince( Collection<UUID> ownerIds, LocalDateTime since );

    interface ItemCount {

        UUID getItemId();

        long getCount();
    }
}
