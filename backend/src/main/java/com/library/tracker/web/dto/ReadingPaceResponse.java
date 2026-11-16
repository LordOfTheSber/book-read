package com.library.tracker.web.dto;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Value;

/**
 * Темп чтения за скользящее окно. Делится на дни с чтением, а не на все дни окна: «ноль страниц
 * в день» у человека, читающего по выходным, — неверный ответ, и прогноз завершения из него
 * получился бы бесконечным.
 * <p>
 * {@code windowDays} и {@code activeDays} отдаются рядом с числами намеренно: без них не видно,
 * на чём посчитан темп, и одна сессия за квартал выглядит как устойчивая скорость.
 */
@Value
@Builder
public class ReadingPaceResponse {

    BigDecimal pagesPerDay;
    BigDecimal minutesPerDay;
    BigDecimal pagesPerHour;
    long activeDays;
    long windowDays;
}
