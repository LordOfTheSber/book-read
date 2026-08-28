package com.library.tracker.web.dto;

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
    /** Из них дочитано: карточка справочника показывает не список слов, а состояние чтения. */
    long finishedCount;
    /** Средняя оценка по оценённым произведениям автора; {@code null}, если оценок нет. */
    Double averageRating;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
