package com.library.tracker.web.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MonitoringSettingsResponse {

    boolean metricsEnabled;
    LocalDateTime updatedAt;
}
