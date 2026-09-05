package com.library.tracker.service.metadata;

import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.List;

/**
 * Внешний каталог книг. Провайдеров два и они взаимозаменяемы: Open Library лучше знает
 * издания и обложки, Google Books — свежие и нерусские книги, и ни один не покрывает другой.
 */
public interface MetadataProvider {

    /** Имя каталога, оно же значение поля {@code provider} в находке. */
    String name();

    /**
     * Ищет по свободному запросу или по ISBN. Сетевые сбои и мусор в ответе не поднимаются
     * наверх: пустой список — нормальный ответ, а падать из-за чужого сервиса нельзя.
     */
    List<ExternalBookResponse> search( String query, String isbn, int limit );
}
