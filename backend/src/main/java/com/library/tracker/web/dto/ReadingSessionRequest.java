package com.library.tracker.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

import lombok.Data;

@Data
public class ReadingSessionRequest {

    /** По умолчанию — сегодня: чаще всего заход отмечают сразу после чтения. */
    private LocalDate sessionDate;

    @Min( value = 0, message = "From position must be at least 0" )
    private Integer fromPosition;

    @Min( value = 0, message = "To position must be at least 0" )
    private Integer toPosition;

    @Min( value = 1, message = "Duration must be at least 1 minute" )
    private Integer durationMinutes;

    @Size( max = 2000, message = "Note must be at most 2000 characters" )
    private String note;
}
