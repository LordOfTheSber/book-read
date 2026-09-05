package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "monitoring_settings" )
@Getter
@Setter
public class MonitoringSettings extends BaseAuditEntity {

    @Id
    private Long id = 1L;

    @Column( name = "metrics_enabled", nullable = false )
    private Boolean metricsEnabled;

    @Column( name = "ping_interval_seconds", nullable = false )
    private Integer pingIntervalSeconds;

    @Column( name = "ping_path", nullable = false )
    private String pingPath;
}
