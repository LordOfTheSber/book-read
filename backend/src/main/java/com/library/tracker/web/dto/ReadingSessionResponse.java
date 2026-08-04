package com.library.tracker.web.dto;

import java.time.LocalDate;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReadingSessionResponse {

    UUID id;
    UUID itemId;
    UUID logId;
    LocalDate sessionDate;
    Integer fromPosition;
    Integer toPosition;
    Integer durationMinutes;
    String note;
}
