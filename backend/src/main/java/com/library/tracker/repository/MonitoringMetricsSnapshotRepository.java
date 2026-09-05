package com.library.tracker.repository;

import com.library.tracker.domain.MonitoringMetricsSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonitoringMetricsSnapshotRepository extends JpaRepository<MonitoringMetricsSnapshot, String> {
}
