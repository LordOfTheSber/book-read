package com.library.tracker.web.dto;

import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryItemResponse {

    UUID id;
    MediaKind kind;
    String title;
    String altTitle;
    UUID typeId;
    String typeName;
    UUID sourceId;
    String sourceName;
    String sourceUrl;
    List<AuthorSummary> authors;
    UUID seriesId;
    String seriesName;
    BigDecimal orderInSeries;
    String isbn;
    Integer publishedYear;
    String language;
    Integer pageCount;
    String translator;
    ItemFormat format;
    String bookcase;
    String shelf;
    /** Обложка отдаётся отдельным запросом; здесь только признак, что она есть. */
    boolean hasCover;
    LocalDate startedAt;
    LocalDate finishedAt;
    LocalDate deadline;
    /** Прогресс со всем, что из него считается: процент, остаток, норма в день. */
    ProgressResponse progress;
    /** Номер текущего прохода: со второго это перечитывание. */
    int attempt;
    UUID createdById;
    String createdByUsername;
    String note;
    String review;
    /** Отдельным полем, чтобы интерфейс мог спрятать спойлеры под кат. */
    String reviewSpoiler;
    BigDecimal rating;
    BigDecimal ratingPlot;
    BigDecimal ratingStyle;
    BigDecimal ratingCharacters;
    BigDecimal ratingEnding;
    boolean favorite;
    ReadingStatus status;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
