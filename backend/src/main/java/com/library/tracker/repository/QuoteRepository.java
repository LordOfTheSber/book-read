package com.library.tracker.repository;

import com.library.tracker.domain.Quote;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface QuoteRepository extends JpaRepository<Quote, UUID> {

    List<Quote> findByItemIdOrderByPositionAscCreatedAtAsc( UUID itemId );

    /**
     * Поиск по выпискам всей библиотеки. Владелец проверяется здесь же: цитаты — личные записи,
     * и отдавать чужие нельзя, а {@code userId = null} оставлен администратору.
     */
    @Query( """
            select q
            from Quote q
            join q.item i
            where (:userId is null or i.createdBy.id = :userId)
              and (lower(q.text) like lower(concat('%', :query, '%'))
                   or lower(coalesce(q.note, '')) like lower(concat('%', :query, '%')))
            order by q.updatedAt desc
            """ )
    List<Quote> search( String query, java.util.UUID userId );
}
