package com.library.tracker.repository;

import com.library.tracker.domain.Loan;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LoanRepository extends JpaRepository<Loan, UUID> {

    List<Loan> findByItemIdOrderByLentOnDesc( UUID itemId );

    /**
     * Что сейчас на руках у всей библиотеки владельца. Просроченность считается на клиенте от
     * {@code dueOn}: держать её колонкой значило бы пересчитывать таблицу каждую полночь.
     */
    @EntityGraph( attributePaths = { "item" } )
    @Query( """
            select l
            from Loan l
            where l.returnedOn is null
              and (:userId is null or l.item.createdBy.id = :userId)
            order by case when l.dueOn is null then 1 else 0 end, l.dueOn, l.lentOn
            """ )
    List<Loan> findOpen( UUID userId );

    /** Открытая выдача у произведения одна: второй экземпляр — это вторая запись в библиотеке. */
    @Query( """
            select count(l) > 0
            from Loan l
            where l.item.id = :itemId and l.returnedOn is null
            """ )
    boolean existsOpenForItem( UUID itemId );

    @Query( """
            select count(l)
            from Loan l
            where l.returnedOn is null
              and l.dueOn is not null
              and l.dueOn < :today
              and l.item.createdBy.id = :userId
            """ )
    long countOverdue( UUID userId, LocalDate today );
}
