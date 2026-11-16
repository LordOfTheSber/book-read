package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Произведение в составе полки. Набор полей публично безопасный: приватная заметка сюда не
 * попадает, потому что полку можно открыть другим пользователям.
 */
@Value
@Builder
public class ShelfItemResponse {

    UUID id;
    MediaKind kind;
    String title;
    String altTitle;
    List<String> authorNames;
    boolean hasCover;
    BigDecimal rating;
    ReadingStatus status;
    String review;
}
