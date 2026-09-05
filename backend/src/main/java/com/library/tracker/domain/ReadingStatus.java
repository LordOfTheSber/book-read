package com.library.tracker.domain;

public enum ReadingStatus {
    READING,
    /** Отложено: к произведению собираются вернуться, в отличие от {@link #DROPPED}. */
    ON_HOLD,
    DROPPED,
    COMPLETED,
    PLANNED
}
