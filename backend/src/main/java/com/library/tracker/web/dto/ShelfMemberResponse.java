package com.library.tracker.web.dto;

import com.library.tracker.domain.ShelfRole;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ShelfMemberResponse {

    UUID id;
    ProfileSummaryResponse user;
    ShelfRole role;
    OffsetDateTime createdAt;
}
