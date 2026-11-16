package com.library.tracker.web.dto;

import java.util.List;

import lombok.Builder;
import lombok.Value;

/**
 * Находка внешнего каталога. Сюда сведены поля, которые умеют отдавать и Open Library,
 * и Google Books: остальное у провайдеров расходится и в карточку всё равно не ложится.
 */
@Value
@Builder
public class ExternalBookResponse {

    /** Каталог, из которого пришла запись: «OPEN_LIBRARY» или «GOOGLE_BOOKS». */
    String provider;
    /** Идентификатор внутри каталога — на случай повторного обращения за подробностями. */
    String externalId;
    String title;
    String altTitle;
    List<String> authorNames;
    String isbn;
    Integer publishedYear;
    String language;
    Integer pageCount;
    String publisher;
    String description;
    /** Адрес обложки в каталоге: карточка забирает её отдельным запросом к нашему серверу. */
    String coverUrl;
}
