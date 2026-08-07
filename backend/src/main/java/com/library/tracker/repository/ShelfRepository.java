package com.library.tracker.repository;

import com.library.tracker.domain.Shelf;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ShelfRepository extends JpaRepository<Shelf, UUID> {

    List<Shelf> findByOwnerIdOrderByNameAsc( UUID ownerId );

    boolean existsByOwnerIdAndNameIgnoreCase( UUID ownerId, String name );

    Optional<Shelf> findByOwnerIdAndNameIgnoreCase( UUID ownerId, String name );

    /** Состав нужен всякий раз, когда полку правят: без графа это ещё один запрос на каждую. */
    @EntityGraph( attributePaths = { "owner", "items" } )
    Optional<Shelf> findWithItemsById( UUID id );

    @Query( """
            select s.id as shelfId, count(i) as count
            from Shelf s
            left join s.items i
            where s.owner.id = :ownerId
            group by s.id
            """ )
    List<ShelfCount> countItemsByShelf( UUID ownerId );

    /**
     * Полки для страницы выдачи — одним запросом на всю страницу. Ограничены полками
     * спрашивающего: чужие полки, на которых лежит запись, его не касаются.
     */
    @Query( """
            select i.id as itemId, s.id as shelfId, s.name as name
            from Shelf s
            join s.items i
            where i.id in :itemIds and s.owner.id = :ownerId
            order by s.name
            """ )
    List<ItemShelfRow> findShelvesByItemIds( Collection<UUID> itemIds, UUID ownerId );

    interface ShelfCount {

        UUID getShelfId();

        long getCount();
    }

    interface ItemShelfRow {

        UUID getItemId();

        UUID getShelfId();

        String getName();
    }
}
