package com.library.tracker.repository;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    /**
     * Совпадение по ISBN без разделителей: «978-5-17-104967-6» и «9785171049676» — одна книга.
     * Индекс на V14 построен по тому же выражению.
     */
    @Query( """
            select li
            from LibraryItem li
            left join fetch li.authors
            where li.isbn is not null
              and replace(replace(li.isbn, '-', ''), ' ', '') = :normalizedIsbn
              and (:userId is null or li.createdBy.id = :userId)
            """ )
    List<LibraryItem> findByNormalizedIsbn( String normalizedIsbn, UUID userId );

    /**
     * Нечёткое совпадение названия через pg_trgm: «Задача трёх тел» и «Задача трех тел» —
     * одна книга, а точное сравнение их не сведёт. Оператор {@code %} опирается на GIN-индекс,
     * поэтому проверка не превращается в полный проход по таблице.
     */
    @Query( value = """
            select li.*
            from library_items li
            where lower(li.title) % lower(:title)
              and (:userId is null or li.created_by = :userId)
            order by similarity(lower(li.title), lower(:title)) desc
            limit 10
            """, nativeQuery = true )
    List<LibraryItem> findSimilarByTitle( String title, UUID userId );

    /** Записи с этой пометкой: нужны объединению тегов, которое переносит их на другой тег. */
    @Query( """
            select li
            from LibraryItem li
            join li.tags t
            where t.id = :tagId
            """ )
    List<LibraryItem> findByTagId( UUID tagId );

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

    /**
     * Разбивка по видам произведения. Нужна корешковой полосе: её ширины — доли коллекции,
     * а не украшение, поэтому считать их на клиенте по текущей странице выдачи нельзя.
     */
    @Query( """
            select li.kind as kind, count(li) as count
            from LibraryItem li
            where li.kind is not null and (:userId is null or li.createdBy.id = :userId)
            group by li.kind
            """ )
    List<KindCount> countByKind( UUID userId );

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

    /**
     * Завершённые за период — общий срез для цели года, «Года в обзоре» и достижений. Даты берутся
     * с карточки, а не с прохода: перечитывание года не меняет, а карточка есть у каждой записи.
     */
    @Query( """
            select li
            from LibraryItem li
            left join fetch li.authors
            where li.createdBy.id = :userId
              and li.finishedAt is not null
              and li.finishedAt between :from and :to
            order by li.finishedAt
            """ )
    List<LibraryItem> findFinishedBetween( UUID userId, LocalDate from, LocalDate to );

    @Query( """
            select count(li)
            from LibraryItem li
            where li.createdBy.id = :userId
              and li.finishedAt is not null
              and li.finishedAt between :from and :to
            """ )
    long countFinishedBetween( UUID userId, LocalDate from, LocalDate to );

    /**
     * Прочитанные страницы за период. Шкала прогресса подходит не всегда (у фильма её нет),
     * поэтому берётся объём издания, и только у того, что действительно дочитано.
     */
    @Query( """
            select coalesce(sum(li.pageCount), 0)
            from LibraryItem li
            where li.createdBy.id = :userId
              and li.pageCount is not null
              and li.finishedAt is not null
              and li.finishedAt between :from and :to
            """ )
    long sumPagesFinishedBetween( UUID userId, LocalDate from, LocalDate to );

    @Query( """
            select count(li)
            from LibraryItem li
            where li.createdBy.id = :userId and li.review is not null and length(trim(li.review)) > 0
            """ )
    long countReviews( UUID userId );

    @Query( """
            select count(distinct lower(li.language))
            from LibraryItem li
            where li.createdBy.id = :userId and li.language is not null and length(trim(li.language)) > 0
            """ )
    long countDistinctLanguages( UUID userId );

    @Query( "select count(distinct li.kind) from LibraryItem li where li.createdBy.id = :userId" )
    long countDistinctKinds( UUID userId );

    /**
     * Отзывы для публичного профиля. Приватная заметка сюда не попадает по построению — берутся
     * только записи с непустым отзывом, а сборка ответа отдаёт публично безопасный набор полей.
     */
    @Query( """
            select li
            from LibraryItem li
            left join fetch li.authors
            where li.createdBy.id = :userId
              and li.review is not null and length(trim(li.review)) > 0
            order by coalesce(li.finishedAt, cast(li.updatedAt as date)) desc
            """ )
    List<LibraryItem> findReviewed( UUID userId, Pageable pageable );

    /**
     * Записи по списку идентификаторов вместе с авторами и владельцем: лента достаёт так отзывы
     * своих событий, и без выборки авторов сюда каждая карточка стоила бы отдельного запроса.
     */
    @Query( """
            select distinct li
            from LibraryItem li
            left join fetch li.authors
            left join fetch li.createdBy
            where li.id in :ids
            """ )
    List<LibraryItem> findAllWithAuthors( Collection<UUID> ids );

    /**
     * Помесячная динамика. Год и месяц отдаются числами, а склейку в {@code 2026-08} делает сервис:
     * в JPQL это была бы конкатенация с приведением типов, читаемая хуже, чем строчка на Java.
     */
    @Query( """
            select year(li.finishedAt) as year,
                   month(li.finishedAt) as month,
                   count(li) as finished,
                   coalesce(sum(li.pageCount), 0) as pages
            from LibraryItem li
            where li.finishedAt is not null
              and li.finishedAt >= :from
              and (:userId is null or li.createdBy.id = :userId)
            group by year(li.finishedAt), month(li.finishedAt)
            order by year(li.finishedAt), month(li.finishedAt)
            """ )
    List<PeriodCount> countFinishedByMonth( UUID userId, LocalDate from );

    /** Погодная динамика без окна: годов набирается десяток, а не сотня, и обрезать их незачем. */
    @Query( """
            select year(li.finishedAt) as year,
                   0 as month,
                   count(li) as finished,
                   coalesce(sum(li.pageCount), 0) as pages
            from LibraryItem li
            where li.finishedAt is not null
              and (:userId is null or li.createdBy.id = :userId)
            group by year(li.finishedAt)
            order by year(li.finishedAt)
            """ )
    List<PeriodCount> countFinishedByYear( UUID userId );

    /**
     * Итог произвольного отрезка. Нужен сравнению «год к году»: текущий год сравнивается не
     * с полным прошлым, а с тем же отрезком прошлого года — иначе в августе любой год выглядит
     * провалом просто потому, что он ещё не кончился.
     */
    @Query( """
            select count(li) as finished, coalesce(sum(li.pageCount), 0) as pages
            from LibraryItem li
            where li.finishedAt between :from and :to
              and (:userId is null or li.createdBy.id = :userId)
            """ )
    RangeTotals finishedBetweenScoped( UUID userId, LocalDate from, LocalDate to );

    /**
     * Счётчики авторов вместе с именами. {@link #countByAuthor} для этого не годится: он отдаёт
     * только идентификаторы, потому что вызывающий уже держит список авторов и подставляет имена
     * сам, — здесь такого списка нет, и без имени пришлось бы делать второй запрос.
     */
    @Query( """
            select a.id as authorId, a.name as authorName, count(li) as count
            from LibraryItem li
            join li.authors a
            where (:userId is null or li.createdBy.id = :userId)
            group by a.id, a.name
            order by count(li) desc, a.name
            """ )
    List<NamedAuthorCount> countByAuthorNamed( UUID userId, Pageable pageable );

    /**
     * Язык нормализуется к нижнему регистру: «Русский» и «русский» — один язык, а разводить их
     * по двум строкам графика значит показать неверную картину из-за регистра ввода.
     */
    @Query( """
            select lower(li.language) as label, count(li) as count
            from LibraryItem li
            where li.language is not null and length(trim(li.language)) > 0
              and (:userId is null or li.createdBy.id = :userId)
            group by lower(li.language)
            order by count(li) desc
            """ )
    List<LabelCount> countByLanguage( UUID userId );

    /** Десятилетие издания — целочисленное деление года: 1987 попадает в 1980-е. */
    @Query( """
            select (li.publishedYear / 10) * 10 as decade, count(li) as count
            from LibraryItem li
            where li.publishedYear is not null
              and (:userId is null or li.createdBy.id = :userId)
            group by (li.publishedYear / 10) * 10
            order by (li.publishedYear / 10) * 10
            """ )
    List<DecadeCount> countByDecade( UUID userId );

    /** Купленное — то, у чего проставлена цена; см. {@code PurchaseStatsResponse}. */
    @Query( """
            select count(li)
            from LibraryItem li
            where li.price is not null and (:userId is null or li.createdBy.id = :userId)
            """ )
    long countPurchased( UUID userId );

    @Query( """
            select count(li)
            from LibraryItem li
            where li.price is not null
              and li.status = com.library.tracker.domain.ReadingStatus.COMPLETED
              and (:userId is null or li.createdBy.id = :userId)
            """ )
    long countPurchasedFinished( UUID userId );

    /**
     * Купленное и не начатое — та самая полка «когда-нибудь». Из непрочитанного берётся только
     * {@code PLANNED}: начатое и отложенное уже открывали, и упрёком оно не является.
     */
    @Query( """
            select count(li)
            from LibraryItem li
            where li.price is not null
              and li.status = com.library.tracker.domain.ReadingStatus.PLANNED
              and (:userId is null or li.createdBy.id = :userId)
            """ )
    long countPurchasedUnread( UUID userId );

    @Query( """
            select coalesce(li.currency, '') as currency, sum(li.price) as total
            from LibraryItem li
            where li.price is not null and (:userId is null or li.createdBy.id = :userId)
            group by coalesce(li.currency, '')
            """ )
    List<CurrencyTotal> sumPriceByCurrency( UUID userId );

    /** Кандидаты на прогноз завершения: читается прямо сейчас и шкала прогресса заполнена. */
    @Query( """
            select li
            from LibraryItem li
            where li.status = com.library.tracker.domain.ReadingStatus.READING
              and li.progressCurrent is not null
              and li.progressTotal is not null
              and li.progressTotal > li.progressCurrent
              and (:userId is null or li.createdBy.id = :userId)
            """ )
    List<LibraryItem> findInProgressWithProgress( UUID userId );

    /**
     * Страница библиотеки владельца — для выгрузки своих данных. Граф тот же, что у списка книг:
     * коллекции в него не входят, их забирают отдельными запросами на всю страницу сразу.
     */
    @EntityGraph( attributePaths = { "type", "source", "series" } )
    Page<LibraryItem> findByCreatedById( UUID createdById, Pageable pageable );

    /**
     * Ключи обложек владельца. Файлы лежат в объектном хранилище, и каскад БД до них не достаёт:
     * при удалении аккаунта их приходится вычищать отдельно.
     */
    @Query( """
            select li.coverKey
            from LibraryItem li
            where li.createdBy.id = :userId and li.coverKey is not null
            """ )
    List<String> findCoverKeysByOwner( UUID userId );

    interface AuthorCount {

        UUID getAuthorId();

        long getCount();
    }

    interface NamedAuthorCount {

        UUID getAuthorId();

        String getAuthorName();

        long getCount();
    }

    interface RangeTotals {

        long getFinished();

        long getPages();
    }

    /** Месяц равен нулю у погодной выборки: год там и есть весь период. */
    interface PeriodCount {

        int getYear();

        int getMonth();

        long getFinished();

        long getPages();
    }

    interface LabelCount {

        String getLabel();

        long getCount();
    }

    interface DecadeCount {

        int getDecade();

        long getCount();
    }

    interface CurrencyTotal {

        String getCurrency();

        BigDecimal getTotal();
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

    interface KindCount {

        MediaKind getKind();

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
