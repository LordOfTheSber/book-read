package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NodeMemoryDetailResponse {

    UUID nodeId;
    String nodeKey;
    MemoryUsageDto memoryUsage;
    V8HeapStatisticsDto v8HeapStatistics;
    List<ProcessInfoDto> topProcessesByMemory;
    LocalDateTime timestamp;

    @Value
    @Builder
    public static class MemoryUsageDto {
        Long rss;
        Long heapTotal;
        Long heapUsed;
        Long external;
        Long arrayBuffers;
    }

    @Value
    @Builder
    public static class V8HeapStatisticsDto {
        Long totalHeapSize;
        Long usedHeapSize;
        Long heapSizeLimit;
        Long totalAvailableSize;
        Long totalPhysicalSize;
        Long mallocedMemory;
        Long peakMallocedMemory;
    }

    @Value
    @Builder
    public static class ProcessInfoDto {
        Long pid;
        String user;
        Double cpuPercent;
        Double memoryPercent;
        Long residentMemoryKb;
        Long virtualMemoryKb;
        String command;
    }
}
