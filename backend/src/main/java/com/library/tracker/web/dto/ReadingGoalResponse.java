package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/** Челлендж года. Прогресс считается по библиотеке и заходам, а не хранится в колонке. */
@Value
@Builder
public class ReadingGoalResponse {

    int year;
    /** Цель может быть не заведена: тогда метрики пустые, а страница предлагает её поставить. */
    boolean configured;
    GoalMetricResponse items;
    GoalMetricResponse pages;
    GoalMetricResponse minutes;
    int daysLeft;
    int daysPassed;
    /** Все заведённые цели года достигнуты. */
    boolean completed;
}
