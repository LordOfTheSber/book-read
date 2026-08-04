package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SeriesResponse {

    UUID id;
    String name;
    String description;
    /** Сколько частей цикла есть в библиотеке и сколько из них прочитано. */
    long itemCount;
    long completedCount;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
