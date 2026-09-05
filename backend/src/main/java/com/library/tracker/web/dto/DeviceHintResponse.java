package com.library.tracker.web.dto;

import java.time.OffsetDateTime;

import lombok.Builder;
import lombok.Value;

/**
 * Кого предложить на экране входа. Отдаётся до аутентификации, поэтому здесь только то, что и так
 * знает владелец устройства: как его зовут и что это за устройство. Ни роли, ни аватара, ни
 * идентификатора — они не нужны, чтобы узнать себя в кнопке «продолжить как».
 */
@Value
@Builder
public class DeviceHintResponse {

    String username;
    String displayName;
    String deviceLabel;
    OffsetDateTime lastUsedAt;
}
