package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.Map;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ImportResponse {

    String fileName;
    /** Версия формата прочитанной копии: по ней видно, насколько старую копию подняли. */
    int schemaVersion;
    /** Когда была снята копия, а не когда её восстановили. */
    OffsetDateTime exportedAt;
    long restoredUsers;
    long restoredItems;
    long restoredBookTypes;
    long restoredSources;
    long restoredSystemNodes;
    long restoredSessions;
    /** Разбивка по разделам: ключ — имя раздела, значение — число восстановленных записей. */
    Map<String, Long> counts;
}
