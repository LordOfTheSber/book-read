package com.library.tracker.web.dto;

import java.util.List;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryImportResultResponse {

    int imported;
    int skippedAsDuplicate;
    int failed;
    /** Что именно не завелось, с номерами строк исходного файла. */
    List<String> errors;
}
