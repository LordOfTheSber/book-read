package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Строка пользовательского импорта после разбора. Один и тот же тип ездит в обе стороны:
 * превью возвращает разобранные строки, клиент присылает обратно те, которые решил завести, —
 * при этом их можно поправить, не переразбирая файл.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LibraryImportRow {

    /** Номер строки в исходном файле: без него непонятно, к чему относится ошибка. */
    private int line;

    private String title;

    private List<String> authorNames;

    private String isbn;

    private Integer publishedYear;

    private Integer pageCount;

    private String seriesName;

    private BigDecimal rating;

    private ReadingStatus status;

    private MediaKind kind;

    private LocalDate startedAt;

    private LocalDate finishedAt;

    private String review;

    private String note;

    private List<String> tagNames;

    /** Строки без названия завести нельзя: они и остаются в превью с пометкой. */
    @Builder.Default
    private List<String> errors = new ArrayList<>();

    /** Что в библиотеке похоже на эту строку. Пустой список — записи такой ещё нет. */
    @Builder.Default
    private List<DuplicateCandidateResponse> duplicates = new ArrayList<>();
}
