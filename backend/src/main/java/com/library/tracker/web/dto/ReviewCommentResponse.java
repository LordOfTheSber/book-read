package com.library.tracker.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReviewCommentResponse {

    UUID id;
    ProfileSummaryResponse author;
    String body;
    OffsetDateTime createdAt;
    /** Своё удаляет автор, чужое — владелец отзыва и администратор. */
    boolean canDelete;
}
