package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MonitoringMetricsResponse {

    boolean enabled;
    GlobalMetricsResponse global;
    List<EndpointMetricsResponse> endpoints;
    List<SlowRequestResponse> slowRequests;
    LocalDateTime generatedAt;

    @Value
    @Builder
    public static class GlobalMetricsResponse {

        long totalRequests;
        long errorRequests;
        double averageDurationMs;
        long maxDurationMs;
        LocalDateTime lastRequestAt;
    }
}
