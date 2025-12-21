package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookTypeResponse {
    UUID id;
    String name;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
