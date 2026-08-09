package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Итог одного периода. Период — строка, а не пара чисел, потому что один и тот же тип отдаётся
 * и помесячно ({@code 2026-08}), и погодно ({@code 2026}): клиенту нужна подпись оси, а не
 * арифметика над номером месяца.
 */
@Value
@Builder
public class PeriodStatsResponse {

    String period;
    long finished;
    long pages;
    long minutes;
}
