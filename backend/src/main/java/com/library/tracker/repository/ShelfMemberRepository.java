package com.library.tracker.repository;

import com.library.tracker.domain.ShelfMember;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ShelfMemberRepository extends JpaRepository<ShelfMember, UUID> {

    @EntityGraph( attributePaths = { "user" } )
    List<ShelfMember> findByShelfIdOrderByCreatedAtAsc( UUID shelfId );

    Optional<ShelfMember> findByShelfIdAndUserId( UUID shelfId, UUID userId );

    /** Полки, куда пользователя позвали: они показываются рядом со своими. */
    @EntityGraph( attributePaths = { "shelf", "shelf.owner" } )
    List<ShelfMember> findByUserId( UUID userId );

    long countByShelfId( UUID shelfId );

    /** Счётчики участников для списка полок — одним запросом на список, а не по запросу на полку. */
    @Query( """
            select m.shelf.id as shelfId, count(m) as count
            from ShelfMember m
            where m.shelf.id in :shelfIds
            group by m.shelf.id
            """ )
    List<ShelfCount> countByShelfIds( Collection<UUID> shelfIds );

    interface ShelfCount {

        UUID getShelfId();

        long getCount();
    }

    void deleteByShelfIdAndUserId( UUID shelfId, UUID userId );
}
