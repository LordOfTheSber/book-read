package com.library.tracker.web.dto;

import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.ReadingStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import lombok.Data;

@Data
public class LibraryItemRequest {

    private MediaKind kind = MediaKind.BOOK;

    @NotBlank( message = "Title is required" )
    private String title;

    private String altTitle;

    private UUID typeId;

    private UUID sourceId;

    /**
     * Авторы приходят именами, а не идентификаторами: заводить автора отдельным действием ради
     * одной книги — лишний шаг. Существующие подхватываются без учёта регистра, новые заводятся.
     */
    private List<String> authorNames;

    /** Название серии; ведёт себя так же, как авторы. */
    @Size( max = 255, message = "Series name must be at most 255 characters" )
    private String seriesName;

    @DecimalMin( value = "0.0", message = "Order in series must be at least 0" )
    @Digits( integer = 4, fraction = 2, message = "Order in series must have at most two decimal places" )
    private BigDecimal orderInSeries;

    @Size( max = 20, message = "ISBN must be at most 20 characters" )
    private String isbn;

    @Min( value = 1, message = "Published year must be a positive number" )
    @Max( value = 2999, message = "Published year looks implausible" )
    private Integer publishedYear;

    @Size( max = 32, message = "Language must be at most 32 characters" )
    private String language;

    @Min( value = 1, message = "Page count must be at least 1" )
    private Integer pageCount;

    @Size( max = 255, message = "Translator must be at most 255 characters" )
    private String translator;

    private ItemFormat format;

    @Size( max = 255, message = "Bookcase must be at most 255 characters" )
    private String bookcase;

    @Size( max = 255, message = "Shelf must be at most 255 characters" )
    private String shelf;

    /**
     * Даты можно проставить руками, но обычно их выставляет сама смена статуса: «читаю» ставит
     * начало, «прочитано» — завершение.
     */
    private LocalDate startedAt;

    private LocalDate finishedAt;

    private LocalDate deadline;

    @Min( value = 0, message = "Progress must be at least 0" )
    private Integer progressCurrent;

    @Min( value = 1, message = "Progress total must be at least 1" )
    private Integer progressTotal;

    private ProgressUnit progressUnit;

    /** Приватная заметка: видна только владельцу. */
    private String note;

    /** Публичный отзыв — то, что имеет смысл показывать другим. */
    private String review;

    /** Часть отзыва со спойлерами: интерфейс прячет её под кат. */
    private String reviewSpoiler;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal rating;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal ratingPlot;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal ratingStyle;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal ratingCharacters;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal ratingEnding;

    private boolean favorite;

    private ReadingStatus status = ReadingStatus.PLANNED;
}
