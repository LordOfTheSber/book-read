package com.library.tracker.web.dto;

import com.library.tracker.domain.Role;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserResponse {

    UUID id;
    String username;
    Role role;
    String avatar;
    String avatarContentType;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
