package com.library.tracker.domain;

/**
 * Единица прогресса. У текста это страницы, у аудио — минуты, у сериала — эпизоды,
 * у манги — тома: сущность одна, меняется только шкала.
 */
public enum ProgressUnit {
    PAGES,
    MINUTES,
    EPISODES,
    VOLUMES
}
