package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class TypeCountResponse {

    UUID typeId;
    String typeName;
    long count;
}
