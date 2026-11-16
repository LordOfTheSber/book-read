package com.library.tracker.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataExportScheduler {

    private final DataExportService dataExportService;

    @Scheduled( cron = "0 0 2 * * *" )
    public void exportDailySnapshot() {
        try {
            DataExportService.ExportResult result = dataExportService.exportData();
            log.info( "Ежедневный бэкап выполнен: {}", result.getPath() );
        } catch ( Exception ex ) {
            log.error( "Не удалось выполнить ежедневный бэкап", ex );
        }
    }
}
