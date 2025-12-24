package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthResponse {

    String token;
    UserResponse user;
}
