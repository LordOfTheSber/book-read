package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "monitoring_metrics_snapshots" )
@Getter
@Setter
public class MonitoringMetricsSnapshot {

    @Id
    @Column( name = "node_key", nullable = false )
    private String nodeKey;

    @Column( name = "captured_at", nullable = false )
    private LocalDateTime capturedAt;

    @Column( name = "total_requests", nullable = false )
    private long totalRequests;

    @Column( name = "error_requests", nullable = false )
    private long errorRequests;

    @Column( name = "average_duration_ms", nullable = false )
    private double averageDurationMs;

    @Column( name = "max_duration_ms", nullable = false )
    private long maxDurationMs;

    @Column( name = "last_request_at" )
    private LocalDateTime lastRequestAt;

    @Column( name = "endpoints_json", columnDefinition = "TEXT" )
    private String endpointsJson;

    @Column( name = "slow_requests_json", columnDefinition = "TEXT" )
    private String slowRequestsJson;
}
