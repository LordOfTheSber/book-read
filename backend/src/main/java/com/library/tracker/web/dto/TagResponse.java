package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TagResponse {

    UUID id;
    String name;
    String color;
    /** Сколько произведений помечено тегом в библиотеке владельца. */
    long itemCount;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
