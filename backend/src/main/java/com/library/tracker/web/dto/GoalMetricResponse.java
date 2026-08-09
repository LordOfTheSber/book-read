package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Одна цифра цели вместе с графиком. Отставание считается от равномерного темпа: без него
 * «12 из 40» в июне и в декабре выглядят одинаково, хотя это разные положения дел.
 */
@Value
@Builder
public class GoalMetricResponse {

    int target;
    long done;
    /** Сколько следовало бы иметь к сегодняшнему дню при равномерном темпе. */
    long expected;
    int percent;
    /** Отставание от графика; опережение отдаётся нулём, чтобы не путать знаком. */
    long behind;
    boolean onTrack;
    /** Ожидаемый итог года, если темп сохранится. */
    long projected;
}
