package com.library.tracker.web.dto;

import com.library.tracker.domain.SavedFilter;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SmartShelfResponse {

    UUID id;
    String name;
    String description;
    SavedFilter filter;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
