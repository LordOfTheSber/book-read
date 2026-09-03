package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/** Итог массового удаления: сколько удалено и сколько пропущено как чужое. */
@Value
@Builder
public class BulkItemDeleteResponse {

    long deleted;
    long skipped;
}
