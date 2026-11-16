package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SlowRequestResponse {

    String method;
    String path;
    int status;
    long durationMs;
    LocalDateTime occurredAt;
}
