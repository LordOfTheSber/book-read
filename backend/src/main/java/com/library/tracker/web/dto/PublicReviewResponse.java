package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Отзыв в чужом профиле. Набор полей публично безопасный: приватная заметка сюда не попадает,
 * а спойлерная часть отдаётся отдельным полем, чтобы клиент спрятал её под кат.
 */
@Value
@Builder
public class PublicReviewResponse {

    UUID itemId;
    MediaKind kind;
    String title;
    List<String> authorNames;
    boolean hasCover;
    BigDecimal rating;
    String review;
    String reviewSpoiler;
    LocalDate finishedAt;
    long reactionCount;
    long commentCount;
}
