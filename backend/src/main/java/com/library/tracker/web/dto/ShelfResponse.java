package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ShelfResponse {

    UUID id;
    String name;
    String description;
    boolean isPublic;
    long itemCount;
    UUID ownerId;
    String ownerUsername;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
