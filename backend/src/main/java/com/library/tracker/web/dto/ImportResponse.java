package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ImportResponse {

    String fileName;
    long restoredUsers;
    long restoredItems;
    long restoredBookTypes;
    long restoredSources;
    long restoredSystemNodes;
    long restoredSessions;
}
