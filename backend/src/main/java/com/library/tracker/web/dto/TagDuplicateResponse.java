package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Подозрение на дубль: два тега, которые стоят почти на одних и тех же записях. Названия здесь
 * ни при чём — «сай-фай» и «фантастика» не похожи ни одной буквой, а значат одно и то же.
 */
@Value
@Builder
public class TagDuplicateResponse {

    /** Тот, что крупнее: объединять предлагается в него, чтобы переносить меньше пометок. */
    TagResponse target;
    /** Тот, что мельче: он и исчезнет при объединении. */
    TagResponse source;
    /** Сколько записей помечено обоими сразу. */
    long overlap;
}
