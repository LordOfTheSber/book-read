package com.library.tracker.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;

import lombok.Data;

/** Цели независимые и необязательные: пустая просто не показывается. */
@Data
public class ReadingGoalRequest {

    @Positive( message = "Цель по количеству должна быть больше нуля" )
    @Max( value = 10_000, message = "Слишком большая цель по количеству" )
    private Integer targetItems;

    @Positive( message = "Цель по страницам должна быть больше нуля" )
    @Max( value = 10_000_000, message = "Слишком большая цель по страницам" )
    private Integer targetPages;

    @Positive( message = "Цель по времени должна быть больше нуля" )
    @Max( value = 1_000_000, message = "Слишком большая цель по времени" )
    private Integer targetMinutes;
}
