package com.library.tracker.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Уборка просроченных доверенных устройств.
 * <p>
 * Истёкшая запись и так не пускает — быстрый вход сверяет срок, — но лежит она месяцами, и без
 * уборки список «мои устройства» показывал бы человеку давно мёртвые строки.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TrustedDeviceCleanupScheduler {

    private final TrustedDeviceService trustedDeviceService;

    @Scheduled( cron = "0 30 3 * * *" )
    public void removeExpiredDevices() {
        try {
            trustedDeviceService.deleteExpired();
        } catch ( Exception ex ) {
            log.error( "Не удалось убрать просроченные доверенные устройства", ex );
        }
    }
}
