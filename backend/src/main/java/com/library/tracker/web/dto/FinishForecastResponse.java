package com.library.tracker.web.dto;

import java.time.LocalDate;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Когда запись будет дочитана при нынешнем темпе. {@code expectedFinish} равен {@code null},
 * если темпа нет: выдуманная дата хуже честного прочерка — на неё начинают смотреть.
 */
@Value
@Builder
public class FinishForecastResponse {

    UUID itemId;
    String title;
    int remaining;
    String unit;
    LocalDate expectedFinish;
}
