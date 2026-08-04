package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class QuoteResponse {

    UUID id;
    UUID itemId;
    /** Название нужно поиску по всем цитатам: там результат оторван от карточки. */
    String itemTitle;
    Integer position;
    String text;
    String note;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
