package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.List;
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
    /** Авторы книги — там же и по той же причине; в выписках одной карточки список пуст. */
    List<String> itemAuthorNames;
    Integer position;
    String text;
    String note;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
