package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Колонка разобранного файла. Нужна затем, чтобы потеря была видна до импорта: колонки чужой
 * выгрузки распознаются по синонимам, и всё, что не распозналось, просто не приедет — молча.
 */
@Value
@Builder
public class LibraryImportColumnResponse {

    /** Имя колонки как в файле: человек ищет глазами именно его. */
    String name;
    /** Поле записи, куда поедет колонка; null — не распознана. */
    String target;
    boolean recognized;
    /** Первое непустое значение колонки: пример объясняет, что именно теряется. */
    String sample;
}
