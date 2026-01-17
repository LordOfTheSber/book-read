package com.library.tracker.web.dto;

import com.library.tracker.web.dto.MonitoringMetricsResponse.GlobalMetricsResponse;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NodeMetricsSnapshotResponse {

    String nodeKey;
    LocalDateTime capturedAt;
    GlobalMetricsResponse global;
    List<EndpointMetricsResponse> endpoints;
    List<SlowRequestResponse> slowRequests;
}
