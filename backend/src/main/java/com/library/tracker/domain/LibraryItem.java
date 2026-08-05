package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "library_items" )
@Getter
@Setter
public class LibraryItem extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Enumerated( EnumType.STRING )
    @Column( name = "kind", nullable = false )
    private MediaKind kind = MediaKind.BOOK;

    @Column( name = "title", nullable = false )
    private String title;

    @Column( name = "alt_title" )
    private String altTitle;

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "type_id" )
    private BookType type;

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "source_id" )
    private Source source;

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "created_by" )
    private User createdBy;

    /**
     * Порядок в наборе не хранится: авторы одного произведения равноправны, а сортировка
     * по имени даёт стабильный вывод без лишнего столбца.
     */
    @ManyToMany( fetch = FetchType.LAZY )
    @JoinTable(
            name = "library_item_authors",
            joinColumns = @JoinColumn( name = "item_id" ),
            inverseJoinColumns = @JoinColumn( name = "author_id" )
    )
    private Set<Author> authors = new LinkedHashSet<>();

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "series_id" )
    private Series series;

    /** Дробный, чтобы побочная повесть встала между вторым и третьим томом. */
    @Column( name = "order_in_series", precision = 6, scale = 2 )
    private BigDecimal orderInSeries;

    @Column( name = "isbn", length = 20 )
    private String isbn;

    @Column( name = "published_year" )
    private Integer publishedYear;

    @Column( name = "language", length = 32 )
    private String language;

    @Column( name = "page_count" )
    private Integer pageCount;

    @Column( name = "translator" )
    private String translator;

    /** Ключ объекта в хранилище обложек; сам файл в БД не лежит. */
    @Column( name = "cover_key" )
    private String coverKey;

    @Column( name = "cover_content_type", length = 100 )
    private String coverContentType;

    @Enumerated( EnumType.STRING )
    @Column( name = "format", length = 32 )
    private ItemFormat format;

    @Column( name = "bookcase" )
    private String bookcase;

    @Column( name = "shelf" )
    private String shelf;

    @Column( name = "started_at" )
    private LocalDate startedAt;

    @Column( name = "finished_at" )
    private LocalDate finishedAt;

    /** «Дочитать к дате»: по нему считаются норма в день и отставание. */
    @Column( name = "deadline" )
    private LocalDate deadline;

    @Column( name = "progress_current" )
    private Integer progressCurrent;

    /**
     * Отделён от {@code pageCount}: то — свойство издания, а это — шкала, по которой считается
     * прогресс. У аудиокниги они не совпадают вовсе.
     */
    @Column( name = "progress_total" )
    private Integer progressTotal;

    @Enumerated( EnumType.STRING )
    @Column( name = "progress_unit", length = 32 )
    private ProgressUnit progressUnit;

    /** Приватная заметка: видна только владельцу. Сюда переехало прежнее поле comment. */
    @Column( name = "note", columnDefinition = "TEXT" )
    private String note;

    /** Публичный отзыв — то, что имеет смысл показывать другим. */
    @Column( name = "review", columnDefinition = "TEXT" )
    private String review;

    /** Спойлерная часть отзыва: отдельным полем её можно спрятать под кат, не разбирая разметку. */
    @Column( name = "review_spoiler", columnDefinition = "TEXT" )
    private String reviewSpoiler;

    @Column( name = "rating", precision = 3, scale = 1 )
    private BigDecimal rating;

    @Column( name = "rating_plot", precision = 3, scale = 1 )
    private BigDecimal ratingPlot;

    @Column( name = "rating_style", precision = 3, scale = 1 )
    private BigDecimal ratingStyle;

    @Column( name = "rating_characters", precision = 3, scale = 1 )
    private BigDecimal ratingCharacters;

    @Column( name = "rating_ending", precision = 3, scale = 1 )
    private BigDecimal ratingEnding;

    @Column( name = "favorite", nullable = false )
    private boolean favorite;

    @Enumerated( EnumType.STRING )
    @Column( name = "status", nullable = false )
    private ReadingStatus status = ReadingStatus.PLANNED;
}
