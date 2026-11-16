package com.library.tracker.web.dto;

import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Похожая запись, уже лежащая в библиотеке. Причина совпадения возвращается вместе с записью:
 * «тот же ISBN» и «похожее название» — разной силы доводы, и решать всё равно пользователю.
 */
@Value
@Builder
public class DuplicateCandidateResponse {

    UUID id;
    String title;
    List<String> authorNames;
    String isbn;
    Integer publishedYear;
    boolean hasCover;
    MatchReason reason;

    public enum MatchReason {
        /** Совпал ISBN без разделителей — практически наверняка та же книга. */
        ISBN,
        /** Совпало название (без учёта регистра и пунктуации) — возможно, другое издание. */
        TITLE
    }
}
