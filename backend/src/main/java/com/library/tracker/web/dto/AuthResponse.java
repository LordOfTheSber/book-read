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
}
