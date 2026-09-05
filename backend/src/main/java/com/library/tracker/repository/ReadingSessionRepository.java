package com.library.tracker.repository;

import com.library.tracker.domain.ReadingSession;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, UUID> {

    List<ReadingSession> findByItemIdOrderBySessionDateDescCreatedAtDesc( UUID itemId );

    /**
     * Заходы для целой страницы записей: выгрузка идёт постранично, и запрос на каждую карточку
     * превратил бы её в тысячи обращений к БД.
     */
    List<ReadingSession> findByItemIdInOrderByItemIdAscSessionDateAsc( Collection<UUID> itemIds );

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

    /**
     * Тепловая карта: минуты и заходы по дням. В отличие от запросов выше здесь допускается
     * {@code userId = null} — аналитику администратор смотрит и по всей базе, и это та же
     * семантика, что у агрегатов {@code LibraryItemRepository}.
     */
    @Query( """
            select rs.sessionDate as date,
                   coalesce(sum(rs.durationMinutes), 0) as minutes,
                   count(rs) as sessions
            from ReadingSession rs
            where rs.sessionDate between :from and :to
              and (:userId is null or rs.item.createdBy.id = :userId)
            group by rs.sessionDate
            order by rs.sessionDate
            """ )
    List<DayActivity> activityByDay( UUID userId, LocalDate from, LocalDate to );

    /** Минуты по месяцам — вторая половина помесячной динамики: дочитанное считается по карточкам. */
    @Query( """
            select year(rs.sessionDate) as year,
                   month(rs.sessionDate) as month,
                   coalesce(sum(rs.durationMinutes), 0) as minutes
            from ReadingSession rs
            where rs.sessionDate >= :from
              and (:userId is null or rs.item.createdBy.id = :userId)
            group by year(rs.sessionDate), month(rs.sessionDate)
            """ )
    List<MonthMinutes> minutesByMonth( UUID userId, LocalDate from );

    /**
     * Минуты за отрезок в области видимости аналитики. От {@link #sumMinutes} отличается тем, что
     * допускает {@code userId = null} — режим «вся база» у администратора.
     */
    @Query( """
            select coalesce(sum(rs.durationMinutes), 0)
            from ReadingSession rs
            where rs.sessionDate between :from and :to
              and (:userId is null or rs.item.createdBy.id = :userId)
            """ )
    long sumMinutesScoped( UUID userId, LocalDate from, LocalDate to );

    /**
     * Сырьё для темпа: пройденные позиции, минуты и число дней с чтением за окно. Позиции берутся
     * только там, где заполнены обе границы, — заход «читал час» без страниц даёт минуты, но не
     * страницы, и подмешивать в скорость нули из-за него нельзя.
     */
    @Query( """
            select coalesce(sum(case when rs.fromPosition is not null and rs.toPosition is not null
                                     then rs.toPosition - rs.fromPosition else 0 end), 0) as positions,
                   coalesce(sum(rs.durationMinutes), 0) as minutes,
                   count(distinct rs.sessionDate) as activeDays
            from ReadingSession rs
            where rs.sessionDate between :from and :to
              and (:userId is null or rs.item.createdBy.id = :userId)
            """ )
    PaceTotals paceTotals( UUID userId, LocalDate from, LocalDate to );

    /** Сколько заходов удалится вместе с записями: то же, что и у выписок, — предупредить заранее. */
    @Query( """
            select count(rs)
            from ReadingSession rs
            where rs.item.id in :itemIds
            """ )
    long countByItems( Collection<UUID> itemIds );

    interface DayActivity {

        LocalDate getDate();

        long getMinutes();

        long getSessions();
    }

    interface MonthMinutes {

        int getYear();

        int getMonth();

        long getMinutes();
    }

    interface PaceTotals {

        long getPositions();

        long getMinutes();

        long getActiveDays();
    }
}
