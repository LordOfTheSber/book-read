package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SourceResponse {

    UUID id;
    String name;
    String url;
    String description;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
