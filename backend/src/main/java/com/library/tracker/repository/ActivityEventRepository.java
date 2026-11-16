package com.library.tracker.repository;

import com.library.tracker.domain.ActivityEvent;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {

    /**
     * Лента: события всех, на кого подписан спрашивающий, плюс его собственные. Автор тянется
     * графом — иначе каждая строка ленты стоила бы отдельного запроса за именем и аватаром.
     */
    @EntityGraph( attributePaths = { "actor" } )
    List<ActivityEvent> findByActorIdInOrderByCreatedAtDesc( Collection<UUID> actorIds, Pageable pageable );

    @EntityGraph( attributePaths = { "actor" } )
    List<ActivityEvent> findByActorIdOrderByCreatedAtDesc( UUID actorId, Pageable pageable );

    /**
     * О чём писали за отрезок: события «написал отзыв» с группировкой по записи. Считается по
     * событиям, а не по самим отзывам, потому что вопрос здесь «что происходило на неделе»,
     * а отзыв, написанный год назад и подправленный вчера, на этой неделе не происходил.
     */
    @Query( """
            select e.item.id as itemId, count(e) as count
            from ActivityEvent e
            where e.type = com.library.tracker.domain.ActivityType.PUBLISHED_REVIEW
              and e.item is not null
              and e.actor.id in :actorIds
              and e.createdAt >= :since
            group by e.item.id
            """ )
    List<ItemCount> countReviewsSince( Collection<UUID> actorIds, LocalDateTime since );

    interface ItemCount {

        UUID getItemId();

        long getCount();
    }
}
