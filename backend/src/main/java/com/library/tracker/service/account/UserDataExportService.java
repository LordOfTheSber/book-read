package com.library.tracker.service.account;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Loan;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingSession;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.SmartShelfRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.repository.UserAchievementRepository;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Выгрузка собственных данных пользователя. Не путать с {@code DataExportService}: тот делает
 * административный бэкап всей базы вместе с хешами паролей и закрыт на супер-администратора.
 * Здесь — ровно то, что принадлежит одному человеку, и ничего чужого.
 * <p>
 * Форматов два, и они отвечают на разные вопросы. CSV — переносимый: его заголовки подобраны так,
 * чтобы файл читался обратно {@code CsvImportParser}, и выгрузка оставалась пригодной для
 * возврата в трекер или переноса в другой сервис. JSON — полный: в нём есть то, чего в табличном
 * формате быть не может, — история проходов, заходы чтения, выписки, полки, цели.
 * <p>
 * Пишется всё потоком: библиотека на несколько тысяч записей вместе с историей чтения не должна
 * собираться в памяти целиком, как это делает административный экспорт.
 */
@Service
@RequiredArgsConstructor
public class UserDataExportService {

    /** Размер страницы обхода: компромисс между числом запросов и объёмом живых сущностей. */
    private static final int PAGE_SIZE = 200;

    /**
     * Заголовки понимает {@code CsvImportParser} — см. его TITLE_KEYS и соседние наборы. Ни одного
     * маркера Goodreads или StoryGraph здесь нет намеренно: файл должен определяться как GENERIC,
     * иначе разбор удвоит оценки, приняв нашу десятибалльную шкалу за пятизвёздочную.
     */
    private static final String[] CSV_HEADERS = {
            "Title", "Author", "ISBN", "Year Published", "Number of Pages", "My Rating", "Status",
            "Date Started", "Date Read", "My Review", "Private Notes", "Series", "Bookshelves"
    };

    /** Обратное отображение к {@code CsvImportParser.STATUSES}: что он поймёт, то и пишем. */
    private static final Map<ReadingStatus, String> CSV_STATUSES = Map.of(
            ReadingStatus.COMPLETED, "read",
            ReadingStatus.READING, "reading",
            ReadingStatus.PLANNED, "to-read",
            ReadingStatus.ON_HOLD, "on-hold",
            ReadingStatus.DROPPED, "dnf" );

    private final LibraryItemRepository libraryItemRepository;
    private final ReadingLogRepository readingLogRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final QuoteRepository quoteRepository;
    private final LoanRepository loanRepository;
    private final ShelfRepository shelfRepository;
    private final SmartShelfRepository smartShelfRepository;
    private final TagRepository tagRepository;
    private final ReadingGoalRepository readingGoalRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final ObjectMapper objectMapper;

    public String fileName( User owner, String format ) {
        String date = OffsetDateTime.now( ZoneOffset.UTC ).toLocalDate().toString();
        return "library-%s-%s.%s".formatted( owner.getUsername(), date, "csv".equals( format ) ? "csv" : "json" );
    }

    /**
     * Табличная выгрузка библиотеки. Тегами становятся и полки, и метки: в одну колонку
     * {@code Bookshelves} у Goodreads складывается то же самое, и разбор читает её так же.
     */
    @Transactional( readOnly = true )
    public void writeCsv( User owner, OutputStream output ) throws IOException {
        Writer writer = new OutputStreamWriter( output, StandardCharsets.UTF_8 );
        CSVFormat format = CSVFormat.Builder.create( CSVFormat.DEFAULT ).setHeader( CSV_HEADERS ).build();

        try ( CSVPrinter printer = new CSVPrinter( writer, format ) ) {
            walkItems( owner, ( page ) -> {
                for ( LibraryItem item : page.items() ) {
                    try {
                        printer.printRecord( item.getTitle(),
                                             join( page.authors().getOrDefault( item.getId(), List.of() ) ),
                                             item.getIsbn(),
                                             item.getPublishedYear(),
                                             item.getPageCount(),
                                             item.getRating(),
                                             CSV_STATUSES.get( item.getStatus() ),
                                             item.getStartedAt(),
                                             item.getFinishedAt(),
                                             item.getReview(),
                                             item.getNote(),
                                             item.getSeries() != null ? item.getSeries().getName() : null,
                                             join( page.tags().getOrDefault( item.getId(), List.of() ) ) );
                    } catch ( IOException ex ) {
                        throw new UncheckedIoException( ex );
                    }
                }
            }, false );
        } catch ( UncheckedIoException ex ) {
            throw ex.getCause();
        }
    }

    /**
     * Полная выгрузка. Пароль, чужие записи и чужие комментарии к своим отзывам сюда не попадают
     * по построению: всё берётся запросами, ограниченными владельцем.
     */
    @Transactional( readOnly = true )
    public void writeJson( User owner, OutputStream output ) throws IOException {
        try ( JsonGenerator json = objectMapper.getFactory().createGenerator( output ) ) {
            json.useDefaultPrettyPrinter();
            json.writeStartObject();
            json.writeStringField( "exportedAt", OffsetDateTime.now( ZoneOffset.UTC ).toString() );
            json.writeObjectFieldStart( "profile" );
            json.writeStringField( "username", owner.getUsername() );
            json.writeStringField( "displayName", owner.getDisplayName() );
            json.writeStringField( "bio", owner.getBio() );
            json.writeBooleanField( "publicProfile", owner.isPublicProfile() );
            json.writeEndObject();

            writeOwnerCollections( owner, json );

            json.writeArrayFieldStart( "items" );
            try {
                walkItems( owner, page -> writeItemsPage( json, page ), true );
            } catch ( UncheckedIoException ex ) {
                throw ex.getCause();
            }
            json.writeEndArray();

            json.writeEndObject();
        }
    }

    private void writeOwnerCollections( User owner, JsonGenerator json ) throws IOException {
        UUID ownerId = owner.getId();

        json.writeFieldName( "tags" );
        objectMapper.writeValue( json, tagRepository.findByOwnerIdOrderByNameAsc( ownerId )
                                                    .stream()
                                                    .map( tag -> Map.of( "name", tag.getName(),
                                                                         "color", nullToEmpty( tag.getColor() ) ) )
                                                    .toList() );

        json.writeFieldName( "shelves" );
        objectMapper.writeValue( json, shelfRepository.findByOwnerIdOrderByNameAsc( ownerId )
                                                      .stream()
                                                      .map( shelf -> Map.of( "name", shelf.getName(),
                                                                             "description",
                                                                             nullToEmpty( shelf.getDescription() ),
                                                                             "public", shelf.isPublic() ) )
                                                      .toList() );

        json.writeFieldName( "smartShelves" );
        objectMapper.writeValue( json, smartShelfRepository.findByOwnerIdOrderByNameAsc( ownerId )
                                                           .stream()
                                                           .map( shelf -> Map.of( "name", shelf.getName(),
                                                                                  "description",
                                                                                  nullToEmpty( shelf.getDescription() ),
                                                                                  "filter", shelf.getFilter() ) )
                                                           .toList() );

        json.writeFieldName( "goals" );
        objectMapper.writeValue( json, readingGoalRepository.findByOwnerIdOrderByYearDesc( ownerId )
                                                            .stream()
                                                            .map( goal -> mapOfNullable(
                                                                    "year", goal.getYear(),
                                                                    "targetItems", goal.getTargetItems(),
                                                                    "targetPages", goal.getTargetPages(),
                                                                    "targetMinutes", goal.getTargetMinutes() ) )
                                                            .toList() );

        json.writeFieldName( "achievements" );
        objectMapper.writeValue( json, userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( ownerId )
                                                                .stream()
                                                                .map( achievement -> mapOfNullable(
                                                                        "code", achievement.getCode(),
                                                                        "unlockedOn", achievement.getUnlockedOn() ) )
                                                                .toList() );
    }

    private void writeItemsPage( JsonGenerator json, ItemPage page ) {
        try {
            for ( LibraryItem item : page.items() ) {
                json.writeStartObject();
                json.writeStringField( "title", item.getTitle() );
                writeIfPresent( json, "altTitle", item.getAltTitle() );
                json.writeStringField( "kind", item.getKind().name() );
                json.writeStringField( "status", item.getStatus().name() );
                writeIfPresent( json, "type", item.getType() != null ? item.getType().getName() : null );
                writeIfPresent( json, "source", item.getSource() != null ? item.getSource().getName() : null );
                writeIfPresent( json, "series", item.getSeries() != null ? item.getSeries().getName() : null );
                writeIfPresent( json, "orderInSeries", item.getOrderInSeries() );
                writeIfPresent( json, "isbn", item.getIsbn() );
                writeIfPresent( json, "publishedYear", item.getPublishedYear() );
                writeIfPresent( json, "language", item.getLanguage() );
                writeIfPresent( json, "pageCount", item.getPageCount() );
                writeIfPresent( json, "translator", item.getTranslator() );
                writeIfPresent( json, "format", item.getFormat() );
                writeIfPresent( json, "bookcase", item.getBookcase() );
                writeIfPresent( json, "shelfLabel", item.getShelf() );
                writeIfPresent( json, "startedAt", item.getStartedAt() );
                writeIfPresent( json, "finishedAt", item.getFinishedAt() );
                writeIfPresent( json, "deadline", item.getDeadline() );
                writeIfPresent( json, "progressCurrent", item.getProgressCurrent() );
                writeIfPresent( json, "progressTotal", item.getProgressTotal() );
                writeIfPresent( json, "progressUnit", item.getProgressUnit() );
                writeIfPresent( json, "note", item.getNote() );
                writeIfPresent( json, "review", item.getReview() );
                writeIfPresent( json, "reviewSpoiler", item.getReviewSpoiler() );
                writeIfPresent( json, "rating", item.getRating() );
                writeIfPresent( json, "ratingPlot", item.getRatingPlot() );
                writeIfPresent( json, "ratingStyle", item.getRatingStyle() );
                writeIfPresent( json, "ratingCharacters", item.getRatingCharacters() );
                writeIfPresent( json, "ratingEnding", item.getRatingEnding() );
                json.writeBooleanField( "favorite", item.isFavorite() );
                json.writeBooleanField( "wishlist", item.isWishlist() );
                writeIfPresent( json, "price", item.getPrice() );
                writeIfPresent( json, "currency", item.getCurrency() );
                writeIfPresent( json, "purchaseUrl", item.getPurchaseUrl() );

                writeNames( json, "authors", page.authors().getOrDefault( item.getId(), List.of() ) );
                writeNames( json, "tags", page.tags().getOrDefault( item.getId(), List.of() ) );
                writeNames( json, "shelves", page.shelves().getOrDefault( item.getId(), List.of() ) );

                writeCollection( json, "readingLogs", page.logs().getOrDefault( item.getId(), List.of() ),
                                 log -> mapOfNullable( "attempt", log.getAttempt(),
                                                       "startedAt", log.getStartedAt(),
                                                       "finishedAt", log.getFinishedAt(),
                                                       "rating", log.getRating(),
                                                       "comment", log.getComment() ) );
                writeCollection( json, "sessions", page.sessions().getOrDefault( item.getId(), List.of() ),
                                 session -> mapOfNullable( "date", session.getSessionDate(),
                                                           "from", session.getFromPosition(),
                                                           "to", session.getToPosition(),
                                                           "minutes", session.getDurationMinutes(),
                                                           "note", session.getNote() ) );
                writeCollection( json, "quotes", page.quotes().getOrDefault( item.getId(), List.of() ),
                                 quote -> mapOfNullable( "position", quote.getPosition(),
                                                         "text", quote.getText(),
                                                         "note", quote.getNote() ) );
                writeCollection( json, "loans", page.loans().getOrDefault( item.getId(), List.of() ),
                                 loan -> mapOfNullable( "borrowerName", loan.getBorrowerName(),
                                                        "borrowerContact", loan.getBorrowerContact(),
                                                        "lentOn", loan.getLentOn(),
                                                        "dueOn", loan.getDueOn(),
                                                        "returnedOn", loan.getReturnedOn(),
                                                        "note", loan.getNote() ) );

                json.writeEndObject();
            }
        } catch ( IOException ex ) {
            throw new UncheckedIoException( ex );
        }
    }

    /**
     * Обход библиотеки страницами. Связи подтягиваются по одному запросу на страницу, а не на
     * запись, — тем же приёмом, что список книг: иначе выгрузка тысячи карточек превратилась бы
     * в десятки тысяч обращений к БД.
     *
     * @param withHistory история чтения нужна только полному формату; для CSV эти запросы —
     *                    чистая трата, там из неё ничего не выводится.
     */
    private void walkItems( User owner, Consumer<ItemPage> handler, boolean withHistory ) {
        Pageable pageable = PageRequest.of( 0, PAGE_SIZE, Sort.by( "title" ).ascending() );
        Page<LibraryItem> page;

        do {
            page = libraryItemRepository.findByCreatedById( owner.getId(), pageable );
            List<UUID> ids = page.getContent().stream().map( LibraryItem::getId ).toList();

            if ( !ids.isEmpty() ) {
                handler.accept( loadPage( page.getContent(), ids, owner.getId(), withHistory ) );
            }
            pageable = pageable.next();
        } while ( page.hasNext() );
    }

    private ItemPage loadPage( List<LibraryItem> items, List<UUID> ids, UUID ownerId, boolean withHistory ) {
        // Авторы и теги — коллекции, и в графе страницы их нет: забираем по одному запросу
        // на всю страницу теми же методами, которыми это делает список книг.
        Map<UUID, List<String>> authors =
                libraryItemRepository.findAuthorsByItemIds( ids )
                                     .stream()
                                     .collect( Collectors.groupingBy( LibraryItemRepository.ItemAuthorRow::getItemId,
                                                                      Collectors.mapping(
                                                                              LibraryItemRepository.ItemAuthorRow::getName,
                                                                              Collectors.toList() ) ) );
        Map<UUID, List<String>> tags =
                tagRepository.findTagsByItemIds( ids )
                             .stream()
                             .collect( Collectors.groupingBy( TagRepository.ItemTagRow::getItemId,
                                                              Collectors.mapping( TagRepository.ItemTagRow::getName,
                                                                                  Collectors.toList() ) ) );
        Map<UUID, List<String>> shelves =
                shelfRepository.findShelvesByItemIds( ids, ownerId )
                               .stream()
                               .collect( Collectors.groupingBy( ShelfRepository.ItemShelfRow::getItemId,
                                                                Collectors.mapping(
                                                                        ShelfRepository.ItemShelfRow::getName,
                                                                        Collectors.toList() ) ) );

        if ( !withHistory ) {
            return new ItemPage( items, authors, tags, shelves, Map.of(), Map.of(), Map.of(), Map.of() );
        }

        return new ItemPage(
                items, authors, tags, shelves,
                groupByItem( readingLogRepository.findByItemIdInOrderByItemIdAscAttemptAsc( ids ),
                             log -> log.getItem().getId() ),
                groupByItem( readingSessionRepository.findByItemIdInOrderByItemIdAscSessionDateAsc( ids ),
                             session -> session.getItem().getId() ),
                groupByItem( quoteRepository.findByItemIdInOrderByItemIdAscPositionAsc( ids ),
                             quote -> quote.getItem().getId() ),
                groupByItem( loanRepository.findByItemIdInOrderByItemIdAscLentOnAsc( ids ),
                             loan -> loan.getItem().getId() ) );
    }

    private <T> Map<UUID, List<T>> groupByItem( List<T> rows, java.util.function.Function<T, UUID> itemId ) {
        return rows.stream().collect( Collectors.groupingBy( itemId ) );
    }

    /**
     * Разделитель — запятая, потому что её же понимает разбор. Имя или метка с запятой внутри при
     * обратном чтении распадётся надвое: это ограничение табличного формата, а не выгрузки, — в
     * JSON те же значения лежат отдельными элементами массива.
     */
    private String join( List<String> values ) {
        return String.join( ", ", values );
    }

    private void writeNames( JsonGenerator json, String field, List<String> names ) throws IOException {
        if ( names.isEmpty() ) {
            return;
        }
        json.writeArrayFieldStart( field );
        for ( String name : names ) {
            json.writeString( name );
        }
        json.writeEndArray();
    }

    private <T> void writeCollection( JsonGenerator json, String field, List<T> rows,
                                      java.util.function.Function<T, Map<String, Object>> mapper ) throws IOException {
        if ( rows.isEmpty() ) {
            return;
        }
        json.writeFieldName( field );
        objectMapper.writeValue( json, rows.stream().map( mapper ).toList() );
    }

    /** Пустые поля в выгрузку не пишутся: файл и без них крупный, а читать его будет человек. */
    private void writeIfPresent( JsonGenerator json, String field, Object value ) throws IOException {
        if ( value == null || ( value instanceof String text && text.isBlank() ) ) {
            return;
        }
        json.writeFieldName( field );
        objectMapper.writeValue( json, value );
    }

    private Map<String, Object> mapOfNullable( Object... keyValues ) {
        java.util.LinkedHashMap<String, Object> map = new java.util.LinkedHashMap<>();
        for ( int index = 0; index < keyValues.length; index += 2 ) {
            if ( keyValues[index + 1] != null ) {
                map.put( (String) keyValues[index], keyValues[index + 1] );
            }
        }
        return map;
    }

    private String nullToEmpty( String value ) {
        return value != null ? value : "";
    }

    /** Страница библиотеки со всеми связями, уже разложенными по идентификаторам записей. */
    private record ItemPage( List<LibraryItem> items,
                             Map<UUID, List<String>> authors,
                             Map<UUID, List<String>> tags,
                             Map<UUID, List<String>> shelves,
                             Map<UUID, List<ReadingLog>> logs,
                             Map<UUID, List<ReadingSession>> sessions,
                             Map<UUID, List<Quote>> quotes,
                             Map<UUID, List<Loan>> loans ) {
    }

    /**
     * {@link Consumer} не умеет бросать {@link IOException}, а поток обрывается именно им.
     * Обёртка разворачивается обратно на границе метода.
     */
    private static class UncheckedIoException extends RuntimeException {

        UncheckedIoException( IOException cause ) {
            super( cause );
        }

        @Override
        public synchronized IOException getCause() {
            return (IOException) super.getCause();
        }
    }
}
