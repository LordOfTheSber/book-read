package com.library.tracker.repository;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface LibraryItemRepository extends JpaRepository<LibraryItem, UUID>, JpaSpecificationExecutor<LibraryItem> {

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
