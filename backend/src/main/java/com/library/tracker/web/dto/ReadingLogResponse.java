package com.library.tracker.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Один проход по произведению: даты, оценка и то, сколько заходов он занял. */
@Value
@Builder
public class ReadingLogResponse {

    UUID id;
    int attempt;
    LocalDate startedAt;
    LocalDate finishedAt;
    BigDecimal rating;
    /** Критерии этого прохода: при перечитывании оценки обычно расходятся. */
    BigDecimal ratingPlot;
    BigDecimal ratingStyle;
    BigDecimal ratingCharacters;
    BigDecimal ratingEnding;
    String comment;
    long sessionCount;
    /** Сколько дней занял проход; null, пока он не закрыт. */
    Long durationDays;
}
