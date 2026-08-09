package com.library.tracker.web.dto;

import com.library.tracker.domain.ActivityType;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Событие ленты. Подпись — снимок на момент события, поэтому приходит строкой, а не ссылкой. */
@Value
@Builder
public class ActivityResponse {

    UUID id;
    ActivityType type;
    ProfileSummaryResponse actor;
    UUID itemId;
    UUID shelfId;
    String subject;
    String detail;
    OffsetDateTime createdAt;
}
