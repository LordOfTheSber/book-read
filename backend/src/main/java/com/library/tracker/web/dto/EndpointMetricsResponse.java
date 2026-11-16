package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EndpointMetricsResponse {

    String method;
    String path;
    long totalRequests;
    long errorRequests;
    double averageDurationMs;
    long maxDurationMs;
    long lastDurationMs;
    LocalDateTime lastRequestAt;
}
