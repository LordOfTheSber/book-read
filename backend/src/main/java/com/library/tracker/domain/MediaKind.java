package com.library.tracker.domain;

/**
 * Вид произведения. Изначально здесь была одна книга; расширение превращает нишевый книжный
 * трекер в дневник всего просмотренного и прочитанного.
 * <p>
 * У каждого вида своя единица прогресса: у манги — тома, у сериала — эпизоды, у подкаста
 * и аудиокниги — минуты (см. {@link #defaultProgressUnit()}).
 */
public enum MediaKind {

    BOOK( ProgressUnit.PAGES ),
    COMIC( ProgressUnit.PAGES ),
    MANGA( ProgressUnit.VOLUMES ),
    AUDIOBOOK( ProgressUnit.MINUTES ),
    MOVIE( ProgressUnit.MINUTES ),
    SERIES( ProgressUnit.EPISODES ),
    ANIME( ProgressUnit.EPISODES ),
    PODCAST( ProgressUnit.MINUTES ),
    GAME( ProgressUnit.MINUTES );

    private final ProgressUnit defaultProgressUnit;

    MediaKind( ProgressUnit defaultProgressUnit ) {
        this.defaultProgressUnit = defaultProgressUnit;
    }

    /** Единица прогресса по умолчанию: пользователь может задать свою в карточке. */
    public ProgressUnit defaultProgressUnit() {
        return defaultProgressUnit;
    }
}
