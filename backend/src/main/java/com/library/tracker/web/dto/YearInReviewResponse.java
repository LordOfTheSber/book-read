package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import lombok.Builder;
import lombok.Value;

/**
 * «Год в обзоре» — шеринговая карточка. Собирается из тех же срезов, что цель и стрик, поэтому
 * почти бесплатна: новых таблиц ей не нужно.
 */
@Value
@Builder
public class YearInReviewResponse {

    int year;
    long finishedCount;
    long pageCount;
    long minuteCount;
    long readingDays;
    int longestStreak;
    BigDecimal averageRating;
    List<MonthCountResponse> monthly;
    List<PublicReviewResponse> topRated;
    PublicReviewResponse longestItem;
    List<AuthorSummary> topAuthors;
    List<TypeCountResponse> topTypes;
    /**
     * Доли видов произведения за год: из них собирается корешковая полоса на открытке.
     * Считать её на клиенте по списку лучших нельзя — там десяток записей, а не весь год.
     */
    Map<MediaKind, Long> kindBreakdown;
}
