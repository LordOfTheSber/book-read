package com.library.tracker.web.dto;

import java.time.LocalDate;
import java.util.List;

import lombok.Builder;
import lombok.Value;

/**
 * Дни подряд с чтением. Вчерашний день серию не рвёт: она считается «живой», пока не пропущено
 * два дня, — иначе стрик рушился бы у каждого, кто читает по вечерам и однажды лёг раньше.
 */
@Value
@Builder
public class StreakResponse {

    int currentStreak;
    int longestStreak;
    LocalDate lastReadOn;
    boolean readToday;
    /** Дни с чтением за последние восемь недель — на календарную полоску. */
    List<LocalDate> recentDays;
}
