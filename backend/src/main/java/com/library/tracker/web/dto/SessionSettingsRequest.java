package com.library.tracker.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import lombok.Value;

@Value
public class SessionSettingsRequest {

    @NotNull
    @Min( 1 )
    @Max( 10080 ) // up to 7 days
    Integer sessionTtlMinutes;

    @NotNull
    @Min( 1 )
    @Max( 20160 ) // up to 14 days
    Integer maxSessionLifetimeMinutes;
}
