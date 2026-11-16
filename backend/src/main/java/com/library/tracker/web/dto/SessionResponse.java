package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SessionResponse {

    UUID id;
    OffsetDateTime expiresAt;
    OffsetDateTime maxExpiresAt;
}
