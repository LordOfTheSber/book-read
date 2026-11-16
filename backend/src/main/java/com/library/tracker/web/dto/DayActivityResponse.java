package com.library.tracker.web.dto;

import java.time.LocalDate;

import lombok.Builder;
import lombok.Value;

/**
 * День тепловой карты. Отдаются только дни с чтением: пустых в году больше, чем полных,
 * и достроить их по границам окна клиент может сам — так уже сделано с полоской стрика.
 */
@Value
@Builder
public class DayActivityResponse {

    LocalDate date;
    long minutes;
    long sessions;
}
