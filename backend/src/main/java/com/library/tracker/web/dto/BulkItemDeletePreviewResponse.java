package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Последствия массового удаления — числами, до нажатия.
 * <p>
 * «Удалить 17 записей?» ничего не говорит о том, что вместе с ними исчезнут выписки и заходы:
 * записи заводят заново за минуту, а выписки — это то, что человек писал руками.
 */
@Value
@Builder
public class BulkItemDeletePreviewResponse {

    /** Сколько записей из выделения действительно будет удалено. */
    long items;
    /** Сколько пропустится: чужие записи не трогаются и не роняют запрос. */
    long skipped;
    long quotes;
    /** У скольких записей выписки есть: «у 4 из 17» точнее, чем просто «26 выписок». */
    long itemsWithQuotes;
    long sessions;
    long reviews;
}
