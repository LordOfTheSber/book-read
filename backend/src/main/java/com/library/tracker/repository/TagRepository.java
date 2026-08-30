package com.library.tracker.repository;

import com.library.tracker.domain.Tag;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findByOwnerIdOrderByNameAsc( UUID ownerId );

    Optional<Tag> findByOwnerIdAndNameIgnoreCase( UUID ownerId, String name );

    boolean existsByOwnerIdAndNameIgnoreCase( UUID ownerId, String name );

    /**
     * Счётчики для списка тегов одним запросом. Считаются только произведения владельца тега:
     * администратор видит чужой тег в чужой библиотеке, а не суммарно по базе.
     */
    @Query( """
            select t.id as tagId, count(li) as count
            from LibraryItem li
            join li.tags t
            where t.owner.id = :ownerId
            group by t.id
            """ )
    List<TagCount> countByTag( UUID ownerId );

    /** Теги страницы выдачи — одним запросом на всю страницу, а не по запросу на строку. */
    @Query( """
            select li.id as itemId, t.id as tagId, t.name as name, t.color as color
            from LibraryItem li
            join li.tags t
            where li.id in :itemIds
            order by t.name
            """ )
    List<ItemTagRow> findTagsByItemIds( Collection<UUID> itemIds );

    /**
     * Пересечения тегов внутри библиотеки владельца: сколько записей помечено обоими сразу.
     * По ним видно дубли, которые не видно по именам — «сай-фай» и «фантастика» называются
     * по-разному, а стоят на одних и тех же книгах.
     * <p>
     * Пары приходят в обоих порядках: сравнивать идентификаторы в запросе незачем, свернуть
     * их в Java дешевле, чем полагаться на порядок uuid в диалекте.
     */
    @Query( """
            select t1.id as firstId, t2.id as secondId, count(li) as overlap
            from LibraryItem li
            join li.tags t1
            join li.tags t2
            where t1.owner.id = :ownerId
              and t2.owner.id = :ownerId
              and t1.id <> t2.id
            group by t1.id, t2.id
            """ )
    List<TagOverlap> overlaps( UUID ownerId );

    interface TagOverlap {

        UUID getFirstId();

        UUID getSecondId();

        long getOverlap();
    }

    interface TagCount {

        UUID getTagId();

        long getCount();
    }

    interface ItemTagRow {

        UUID getItemId();

        UUID getTagId();

        String getName();

        String getColor();
    }
}
