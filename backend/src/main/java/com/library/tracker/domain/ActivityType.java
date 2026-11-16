package com.library.tracker.domain;

/** Что произошло. Событий немного намеренно: лента из мелких правок читается как журнал ошибок. */
public enum ActivityType {

    /** Начал читать. */
    STARTED_READING,
    /** Дочитал. */
    FINISHED_READING,
    /** Написал отзыв. */
    PUBLISHED_REVIEW,
    /** Оценил. */
    RATED,
    /** Открыл полку. */
    SHARED_SHELF,
    /** Получил достижение. */
    UNLOCKED_ACHIEVEMENT,
    /** Выполнил цель года. */
    REACHED_GOAL
}
