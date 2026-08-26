package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Access-токен в теле ответа не возвращается: он уходит httpOnly-кукой {@code ACCESS_TOKEN},
 * недоступной JavaScript.
 */
@Value
@Builder
public class AuthResponse {

    UserResponse user;
    SessionResponse session;
    /**
     * Запомнено ли устройство. Сам секрет уходит куками, как и всё остальное, но клиенту нужно
     * знать, состоялось ли доверие: браузер мог не отдать отпечаток (например, страница открыта
     * без TLS и {@code crypto.subtle} недоступен), и обещать быстрый вход в этом случае нельзя.
     */
    boolean deviceRemembered;
}
