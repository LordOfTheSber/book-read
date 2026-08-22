package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReactionKind;

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
    /** Год и объём — подпись под названием в ленте: «Стругацкие · 1972 · 224 стр.». */
    Integer publishedYear;
    Integer pageCount;
    boolean hasCover;
    BigDecimal rating;
    String review;
    String reviewSpoiler;
    LocalDate finishedAt;
    long reactionCount;
    long commentCount;
    /** Своя отметка, если она есть: без неё лента не знает, нажато сердце или нет. */
    ReactionKind myReaction;
}
