package com.library.tracker.repository;

import com.library.tracker.domain.ReadingSession;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, UUID> {

    List<ReadingSession> findByItemIdOrderBySessionDateDescCreatedAtDesc( UUID itemId );

    /**
     * Дни, в которые пользователь читал. Стрику и тепловой карте нужны именно даты, а не заходы:
     * три захода за вечер — один день серии, и сводить их на клиенте значило бы тянуть всю историю.
     */
    @Query( """
            select distinct rs.sessionDate
            from ReadingSession rs
            where rs.item.createdBy.id = :userId
              and rs.sessionDate between :from and :to
            order by rs.sessionDate
            """ )
    List<LocalDate> findReadingDates( UUID userId, LocalDate from, LocalDate to );

    @Query( """
            select coalesce(sum(rs.durationMinutes), 0)
            from ReadingSession rs
            where rs.item.createdBy.id = :userId
              and rs.durationMinutes is not null
              and rs.sessionDate between :from and :to
            """ )
    long sumMinutes( UUID userId, LocalDate from, LocalDate to );

    @Query( """
            select count(rs)
            from ReadingSession rs
            where rs.item.createdBy.id = :userId
              and rs.sessionDate between :from and :to
            """ )
    long countSessions( UUID userId, LocalDate from, LocalDate to );
}
