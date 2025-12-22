package com.library.tracker.web.error;

import java.time.OffsetDateTime;
import java.util.List;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ApiError {

    OffsetDateTime timestamp;
    String message;
    List<String> details;
}
