package com.library.tracker.web.dto;

import java.math.BigDecimal;
import java.util.List;

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
}
