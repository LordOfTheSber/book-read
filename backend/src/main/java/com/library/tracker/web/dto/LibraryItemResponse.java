package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryItemResponse {

    UUID id;
    MediaKind kind;
    String title;
    String altTitle;
    UUID typeId;
    String typeName;
    UUID sourceId;
    String sourceName;
    String sourceUrl;
    UUID createdById;
    String createdByUsername;
    String comment;
    BigDecimal rating;
    boolean favorite;
    ReadingStatus status;
    String readUrl;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
