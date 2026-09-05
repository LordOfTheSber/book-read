package com.library.tracker.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

import lombok.Data;

@Data
public class LibraryImportCommitRequest {

    @NotEmpty( message = "Rows are required" )
    @Size( max = 2000, message = "At most 2000 rows can be imported at once" )
    @Valid
    private List<LibraryImportRow> rows;

    /** Общий тег для всей пачки: «импорт из Goodreads» отделяет её от заведённого руками. */
    private List<String> tagNames;

    /** Полка, на которую попадёт вся пачка. */
    private UUID shelfId;

    /**
     * Что делать со строками, для которых нашлись похожие записи. По умолчанию они пропускаются:
     * повторный импорт того же файла не должен удваивать библиотеку.
     */
    private DuplicateStrategy duplicateStrategy = DuplicateStrategy.SKIP;

    public enum DuplicateStrategy {
        SKIP,
        /** Завести как отдельную запись — бывает, что это правда второе издание. */
        IMPORT_ANYWAY
    }
}
