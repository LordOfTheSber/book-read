package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.Map;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ExportResponse {

    String fileName;
    String path;
    String downloadUrl;
    /** Версия формата копии: по ней клиент понимает, что именно лежит в файле. */
    int schemaVersion;
    OffsetDateTime exportedAt;
    long usersCount;
    long itemsCount;
    long bookTypesCount;
    long sourcesCount;
    long sessionsCount;
    long systemNodesCount;
    /**
     * Разбивка по разделам копии: ключ — имя раздела, значение — число записей. Именованные
     * счётчики выше остаются ради совместимости; всё новое приходит сюда, чтобы очередная
     * сущность не требовала правки контракта.
     */
    Map<String, Long> counts;
}
