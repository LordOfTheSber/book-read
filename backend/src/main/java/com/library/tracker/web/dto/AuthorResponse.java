package com.library.tracker.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthorResponse {

    UUID id;
    String name;
    String altName;
    /** Сколько произведений автора в библиотеке спрашивающего. */
    long itemCount;
    /** Из них дочитано — карточка справочника показывает не список слов, а что осталось. */
    long finishedCount;
    /** Средняя оценка по выставленным; {@code null}, если автор ещё не оценивался. */
    BigDecimal avgRating;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
