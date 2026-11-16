package com.library.tracker.service;

import java.time.LocalDateTime;

public record NodeSnapshot(
        String nodeKey,
        String hostname,
        String ip,
        Integer port,
        Double cpuLoad,
        Long systemMemoryTotal,
        Long systemMemoryFree,
        Long heapUsed,
        Long heapCommitted,
        Long heapMax,
        Long diskTotal,
        Long diskFree,
        Long uptimeSeconds,
        LocalDateTime capturedAt
) {
}
