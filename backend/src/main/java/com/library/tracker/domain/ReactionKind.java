package com.library.tracker.domain;

/** Реакция на отзыв. Одна от человека: смена реакции — это правка, а не вторая отметка. */
public enum ReactionKind {

    /** Согласен, полезно. */
    LIKE,
    /** Хочу прочитать после этого отзыва. */
    WANT_TO_READ,
    /** Не согласен с оценкой. */
    DISAGREE
}
