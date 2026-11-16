package com.library.tracker.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import lombok.Value;

@Value
public class UserSessionSettingsRequest {

    @Min( 1 )
    @Max( 20160 )
    Integer sessionTtlMinutes;

    @Min( 1 )
    @Max( 20160 )
    Integer maxSessionLifetimeMinutes;
}
