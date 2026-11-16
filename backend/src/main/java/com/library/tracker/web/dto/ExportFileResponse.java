package com.library.tracker.web.dto;

import java.time.OffsetDateTime;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ExportFileResponse {

    String fileName;
    long sizeBytes;
    OffsetDateTime lastModifiedAt;
    String downloadUrl;
}
