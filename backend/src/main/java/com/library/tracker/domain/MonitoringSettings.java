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
}
