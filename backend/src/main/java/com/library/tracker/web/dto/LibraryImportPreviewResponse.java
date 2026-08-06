package com.library.tracker.web.dto;

import java.util.List;

import lombok.Builder;
import lombok.Value;

/**
 * Разбор файла без единой записи в базе. Импорт из чужого сервиса почти всегда требует правки —
 * поэтому сначала показывается, что получилось, и только потом заводятся записи.
 */
@Value
@Builder
public class LibraryImportPreviewResponse {

    String fileName;
    /** Распознанный источник: «GOODREADS», «STORYGRAPH», «LIVELIB» или «GENERIC». */
    String detectedSource;
    int totalRows;
    int validRows;
    int duplicateRows;
    List<LibraryImportRow> rows;
}
