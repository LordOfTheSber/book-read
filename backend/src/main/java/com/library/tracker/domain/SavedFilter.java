package com.library.tracker.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import lombok.Data;

/**
 * Параметры выдачи, которые умеет сохранять умная полка. Поля повторяют фильтр списка
 * произведений — кроме страницы и размера: они относятся к листанию, а не к самой полке.
 * <p>
 * Неизвестные поля при чтении игнорируются: старая сохранённая полка не должна ломать выдачу
 * после того, как из фильтра убрали параметр.
 */
@Data
@JsonIgnoreProperties( ignoreUnknown = true )
public class SavedFilter {

    private String query;
    private UUID typeId;
    private ReadingStatus status;
    private Boolean favorite;
    private Boolean wishlist;
    private BigDecimal minRating;
    private BigDecimal maxRating;
    private MediaKind kind;
    private LocalDate finishedFrom;
    private LocalDate finishedTo;
    private UUID authorId;
    private UUID seriesId;
    private UUID tagId;
    private UUID shelfId;
    private String sort;
}
