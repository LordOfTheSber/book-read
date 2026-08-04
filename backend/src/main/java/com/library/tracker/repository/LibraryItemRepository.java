package com.library.tracker.repository;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface LibraryItemRepository extends JpaRepository<LibraryItem, UUID>, JpaSpecificationExecutor<LibraryItem> {

    /**
     * Связи ленивые, а {@code toResponse} читает их у каждой строки выдачи: без графа страница
     * из 20 записей превращается в 61 запрос. В графе только {@code *ToOne} — коллекция авторов
     * сюда не входит намеренно, иначе Hibernate утащил бы пагинацию в память.
     */
    @Override
    @EntityGraph( attributePaths = { "type", "source", "createdBy", "series" } )
    Page<LibraryItem> findAll( Specification<LibraryItem> specification, Pageable pageable );

    /** Одиночная выдача не пагинируется, поэтому авторов можно забрать тем же графом. */
    @EntityGraph( attributePaths = { "type", "source", "createdBy", "series", "authors" } )
    Optional<LibraryItem> findWithRelationsById( UUID id );

    /**
     * Авторы для страницы выдачи — одним запросом на всю страницу, а не по запросу на строку.
     * Возвращается плоский список пар, сборка в карточки остаётся сервису.
     */
    @Query( """
            select li.id as itemId, a.id as authorId, a.name as name, a.altName as altName
            from LibraryItem li
            join li.authors a
            where li.id in :itemIds
            order by a.name
            """ )
    List<ItemAuthorRow> findAuthorsByItemIds( Collection<UUID> itemIds );

    interface ItemAuthorRow {

        UUID getItemId();

        UUID getAuthorId();

        String getName();

        String getAltName();
    }

    boolean existsByTypeId( UUID typeId );

    boolean existsBySourceId( UUID sourceId );

    @Query( """
            select count(li)
            from LibraryItem li
            where (:userId is null or li.createdBy.id = :userId)
            """ )
    long countAllByUserId( UUID userId );

    @Query( """
            select count(li)
            from LibraryItem li
            where li.favorite = true and (:userId is null or li.createdBy.id = :userId)
            """ )
    long countFavorites( UUID userId );

    @Query( """
            select li.status as status, count(li) as count
            from LibraryItem li
            where (:userId is null or li.createdBy.id = :userId)
            group by li.status
            """ )
    List<StatusCount> countByStatus( UUID userId );

    @Query( """
            select avg(li.rating)
            from LibraryItem li
            where li.rating is not null and (:userId is null or li.createdBy.id = :userId)
            """ )
    Double averageRating( UUID userId );

    @Query( """
            select li.type.id as typeId, li.type.name as typeName, count(li) as count
            from LibraryItem li
            where li.type is not null and (:userId is null or li.createdBy.id = :userId)
            group by li.type.id, li.type.name
            order by count(li) desc
            """ )
    List<TypeCount> countByType( UUID userId );

    @Query( """
            select li.source.id as sourceId, li.source.name as sourceName, count(li) as count
            from LibraryItem li
            where li.source is not null and (:userId is null or li.createdBy.id = :userId)
            group by li.source.id, li.source.name
            order by count(li) desc
            """ )
    List<SourceCount> countBySource( UUID userId );

    /**
     * Счётчики для списка авторов одним запросом: по строке на автора вместо запроса на каждого.
     * {@code userId = null} — режим администратора, считаем по всей базе.
     */
    @Query( """
            select a.id as authorId, count(li) as count
            from LibraryItem li
            join li.authors a
            where (:userId is null or li.createdBy.id = :userId)
            group by a.id
            """ )
    List<AuthorCount> countByAuthor( UUID userId );

    @Query( """
            select s.id as seriesId,
                   count(li) as count,
                   sum(case when li.status = com.library.tracker.domain.ReadingStatus.COMPLETED then 1 else 0 end)
                       as completedCount
            from LibraryItem li
            join li.series s
            where (:userId is null or li.createdBy.id = :userId)
            group by s.id
            """ )
    List<SeriesCount> countBySeries( UUID userId );

    boolean existsBySeriesId( UUID seriesId );

    @Query( """
            select count(li) > 0
            from LibraryItem li
            join li.authors a
            where a.id = :authorId
            """ )
    boolean existsByAuthorId( UUID authorId );

    interface AuthorCount {

        UUID getAuthorId();

        long getCount();
    }

    interface SeriesCount {

        UUID getSeriesId();

        long getCount();

        long getCompletedCount();
    }

    interface StatusCount {

        ReadingStatus getStatus();

        long getCount();
    }

    interface TypeCount {

        UUID getTypeId();

        String getTypeName();

        long getCount();
    }

    interface SourceCount {

        UUID getSourceId();

        String getSourceName();

        long getCount();
    }
}
