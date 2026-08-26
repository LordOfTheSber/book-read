package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Строка списка «мои устройства». */
@Value
@Builder
public class TrustedDeviceResponse {

    UUID id;
    String label;
    String lastIp;
    OffsetDateTime lastUsedAt;
    OffsetDateTime expiresAt;
    /** Устройство, с которого сделан текущий запрос: его отключение — это выход из доверия здесь. */
    boolean current;
}
