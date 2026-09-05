package com.library.tracker.repository;

import com.library.tracker.domain.Quote;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
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
    List<Quote> search( String query, java.util.UUID userId, Pageable window );

    /**
     * Последние выписки без запроса: страница выписок открывается стеной, а не пустым полем —
     * их перечитывают просто так, не помня ни книги, ни слова. Окно обязательно: в библиотеке
     * на тысячи записей выписок столько же, и отдавать их все незачем.
     */
    @Query( """
            select q
            from Quote q
            join q.item i
            where (:userId is null or i.createdBy.id = :userId)
            order by q.createdAt desc
            """ )
    List<Quote> findRecent( java.util.UUID userId, Pageable window );

    /** Сколько выписок исчезнет вместе с записями: диалог удаления называет последствия числами. */
    @Query( """
            select count(q)
            from Quote q
            where q.item.id in :itemIds
            """ )
    long countByItems( Collection<UUID> itemIds );

    /** У скольких записей из выделения выписки вообще есть: «у 4 из 17» точнее, чем «26 выписок». */
    @Query( """
            select count(distinct q.item.id)
            from Quote q
            where q.item.id in :itemIds
            """ )
    long countItemsWithQuotes( Collection<UUID> itemIds );

    /** Сколько выписок сделал пользователь: нужно достижению «Собиратель». */
    @Query( "select count(q) from Quote q where q.item.createdBy.id = :userId" )
    long countByOwner( java.util.UUID userId );

    /** Выписки для страницы записей — одним запросом, см. {@code ReadingLogRepository}. */
    List<Quote> findByItemIdInOrderByItemIdAscPositionAsc( Collection<UUID> itemIds );
}
