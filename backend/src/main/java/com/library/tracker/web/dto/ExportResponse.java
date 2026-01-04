package com.library.tracker.web.dto;

import java.time.OffsetDateTime;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ExportResponse {

    String fileName;
    String path;
    String downloadUrl;
    OffsetDateTime exportedAt;
    long usersCount;
    long itemsCount;
    long bookTypesCount;
    long sourcesCount;
    long sessionsCount;
    long systemNodesCount;
}
