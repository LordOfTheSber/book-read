package com.library.tracker.web.dto;

import lombok.Data;

@Data
public class MonitoringSettingsUpdateRequest {

    private Integer pingIntervalSeconds;
    private String pingPath;
}
