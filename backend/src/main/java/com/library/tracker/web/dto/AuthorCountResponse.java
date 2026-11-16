package com.library.tracker.web.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthorCountResponse {

    UUID authorId;
    String authorName;
    long count;
}
