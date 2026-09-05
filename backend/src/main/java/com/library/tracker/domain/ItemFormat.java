package com.library.tracker.domain;

/**
 * Формат экземпляра. Влияет на единицу прогресса: у бумаги и электронной книги это страницы,
 * у аудио — минуты.
 */
public enum ItemFormat {
    PAPER,
    EBOOK,
    AUDIO
}
