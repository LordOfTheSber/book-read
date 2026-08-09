package com.library.tracker.repository;

import com.library.tracker.domain.ActivityEvent;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {

    /**
     * Лента: события всех, на кого подписан спрашивающий, плюс его собственные. Автор тянется
     * графом — иначе каждая строка ленты стоила бы отдельного запроса за именем и аватаром.
     */
    @EntityGraph( attributePaths = { "actor" } )
    List<ActivityEvent> findByActorIdInOrderByCreatedAtDesc( Collection<UUID> actorIds, Pageable pageable );

    @EntityGraph( attributePaths = { "actor" } )
    List<ActivityEvent> findByActorIdOrderByCreatedAtDesc( UUID actorId, Pageable pageable );
}
