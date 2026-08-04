package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthorResponse {

    UUID id;
    String name;
    String altName;
    /** Сколько произведений автора в библиотеке спрашивающего. */
    long itemCount;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
