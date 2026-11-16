package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NodeStatusResponse {

    UUID id;
    String nodeKey;
    String hostname;
    String ip;
    Integer port;

    Double cpuLoad;
    Long systemMemoryTotal;
    Long systemMemoryFree;
    Long heapUsed;
    Long heapCommitted;
    Long heapMax;
    Long diskTotal;
    Long diskFree;
    Long uptimeSeconds;

    LocalDateTime lastReportedAt;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
