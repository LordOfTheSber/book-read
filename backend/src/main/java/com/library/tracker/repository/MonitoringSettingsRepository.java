package com.library.tracker.repository;

import com.library.tracker.domain.MonitoringSettings;
import org.springframework.data.repository.CrudRepository;

public interface MonitoringSettingsRepository extends CrudRepository<MonitoringSettings, Long> {
}
