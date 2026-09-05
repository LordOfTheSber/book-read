package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Книга, о которой писали и спорили за последнюю неделю. Считается по тем же событиям, что
 * попадают в ленту: сводка отвечает на вопрос «что обсуждают вокруг меня», а не «что популярно
 * в базе», и потому ограничена теми же открытыми профилями.
 */
@Value
@Builder
public class TrendingBookResponse {

    UUID itemId;
    MediaKind kind;
    String title;
    boolean hasCover;
    long reviewCount;
    long commentCount;
}
