package com.library.tracker.web.dto;

import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Итог массовой правки. Пропущенные перечисляются поимённо: молча потерять часть выделения хуже,
 * чем показать, что именно не изменилось.
 */
@Value
@Builder
public class BulkItemUpdateResponse {

    int updated;
    /** Записи, которых нет или которые принадлежат другому пользователю. */
    List<UUID> skipped;
}
