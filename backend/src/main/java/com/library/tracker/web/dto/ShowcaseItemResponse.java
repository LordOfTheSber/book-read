package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Произведение в витрине справочника: обложка на карточке автора или серии.
 *
 * Полей ровно столько, сколько рисует карточка. Полная выдача сюда не годится: витрина берёт по
 * четыре произведения на карточку и по восемнадцать карточек на страницу — это семьдесят две
 * записи, и каждая лишняя колонка стоит страницы.
 */
@Value
@Builder
public class ShowcaseItemResponse {

    UUID id;
    String title;
    MediaKind kind;
    ReadingStatus status;
    BigDecimal rating;
    boolean hasCover;
}
