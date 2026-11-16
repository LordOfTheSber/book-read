package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class SourceCountResponse {

    UUID sourceId;
    String sourceName;
    long count;
}
