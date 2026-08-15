package com.library.tracker.service.export;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.library.tracker.domain.SavedFilter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Формат файла резервной копии: снимок всей базы, из которого система восстанавливается целиком.
 * <p>
 * Правила, которым подчинён этот класс, важнее его содержимого — от них зависит, прочитается ли
 * завтра файл, снятый сегодня:
 * <ul>
 *     <li>Неизвестные поля игнорируются ({@link JsonIgnoreProperties}). Файл, снятый более новой
 *     версией, читается старой без падения — лишние разделы просто теряются.</li>
 *     <li>Отсутствующий раздел — это {@code null}, а не ошибка. Копия, снятая до появления полок,
 *     восстанавливается как библиотека без полок.</li>
 *     <li>Перечисления хранятся строками. Значение, которого в коде уже нет (или ещё нет), не
 *     обрушивает разбор всего файла: восстановление подставит значение по умолчанию и напишет
 *     в лог, а не откажется читать копию целиком.</li>
 *     <li>Поля не удаляются и не переименовываются — только добавляются. Ушедшее из модели поле
 *     остаётся здесь с пометкой, откуда оно и куда переехало (см. {@link LibraryItemExport#comment}).</li>
 * </ul>
 * Обложки в копию не входят: они лежат в объектном хранилище, а не в БД (см. {@code ObjectStorage}),
 * и у него свой путь резервирования. Ключ объекта сохраняется, поэтому после восстановления базы
 * поверх того же хранилища обложки остаются на месте.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties( ignoreUnknown = true )
public class ExportPayload {

    /**
     * Версия формата на сегодня. Поднимается, когда меняется смысл уже существующего поля;
     * добавление раздела версию не двигает — он и так читается как отсутствующий.
     */
    public static final int CURRENT_SCHEMA_VERSION = 2;

    /** Копии до появления {@link #schemaVersion}: библиотека, типы, источники и пользователи. */
    public static final int LEGACY_SCHEMA_VERSION = 1;

    /** У копий, снятых до её появления, поля нет — такой файл считается {@link #LEGACY_SCHEMA_VERSION}. */
    private Integer schemaVersion;

    private OffsetDateTime exportedAt;

    /** Версия приложения, снявшего копию. Только для чтения человеком. */
    private String applicationVersion;

    private List<UserExport> users;
    private List<BookTypeExport> bookTypes;
    private List<SourceExport> sources;
    private List<AuthorExport> authors;
    private List<SeriesExport> series;
    private List<TagExport> tags;
    private List<ShelfExport> shelves;
    private List<ShelfMemberExport> shelfMembers;
    private List<SmartShelfExport> smartShelves;
    private List<LibraryItemExport> libraryItems;
    private List<ReadingLogExport> readingLogs;
    private List<ReadingSessionExport> readingSessions;
    private List<QuoteExport> quotes;
    private List<LoanExport> loans;
    private List<ReviewCommentExport> reviewComments;
    private List<ReviewReactionExport> reviewReactions;
    private List<UserFollowExport> userFollows;
    private List<ActivityEventExport> activityEvents;
    private List<ReadingGoalExport> readingGoals;
    private List<UserAchievementExport> userAchievements;
    private List<SystemNodeExport> systemNodes;
    private List<SessionExport> sessions;
    private SessionSettingsExport sessionSettings;
    private MonitoringSettingsExport monitoringSettings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class UserExport {

        private UUID id;
        private String username;
        /** Хеш, а не пароль: в копии лежит ровно то, что лежит в колонке. */
        private String password;
        /** Строкой, а не {@code Role}: см. правило о перечислениях в описании класса. */
        private String role;
        private boolean blocked;
        private String avatarBase64;
        private String avatarContentType;
        private Integer sessionTtlOverrideMinutes;
        private Integer maxSessionLifetimeOverrideMinutes;
        /** Появились вместе с социальным слоем (V15); в копиях версии 1 их нет. */
        private String displayName;
        private String bio;
        private Boolean publicProfile;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class BookTypeExport {

        private UUID id;
        private String name;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SourceExport {

        private UUID id;
        private String name;
        private String url;
        private String description;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class AuthorExport {

        private UUID id;
        private String name;
        private String altName;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SeriesExport {

        private UUID id;
        private String name;
        private String description;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class TagExport {

        private UUID id;
        private UUID ownerId;
        private String name;
        private String color;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ShelfExport {

        private UUID id;
        private UUID ownerId;
        private String name;
        private String description;
        private boolean publicShelf;
        /** Состав полки задаётся вручную, поэтому хранится вместе с ней, а не пересчитывается. */
        private List<UUID> itemIds;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ShelfMemberExport {

        private UUID id;
        private UUID shelfId;
        private UUID userId;
        private String role;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SmartShelfExport {

        private UUID id;
        private UUID ownerId;
        private String name;
        private String description;
        /**
         * Сам фильтр, а не его снимок в виде списка записей: умная полка отвечает сегодняшним
         * содержимым библиотеки. {@link SavedFilter} игнорирует неизвестные поля, поэтому старый
         * фильтр читается и после того, как из выдачи убрали параметр.
         */
        private SavedFilter filter;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class LibraryItemExport {

        private UUID id;
        private String kind;
        private String title;
        private String altTitle;
        private UUID typeId;
        /** Только для чтения человеком: восстановление связывает по {@link #typeId}. */
        private String typeName;
        private UUID sourceId;
        private String sourceName;
        private UUID createdById;
        private UUID seriesId;
        private BigDecimal orderInSeries;
        private List<UUID> authorIds;
        private List<UUID> tagIds;
        private String isbn;
        private Integer publishedYear;
        private String language;
        private Integer pageCount;
        private String translator;
        /** Ключ в объектном хранилище: сам файл обложки в копию не входит. */
        private String coverKey;
        private String coverContentType;
        private String format;
        private String bookcase;
        /** Полка как надпись на корешке — не путать с {@link ShelfExport}. */
        private String shelfLabel;
        private LocalDate startedAt;
        private LocalDate finishedAt;
        private LocalDate deadline;
        private Integer progressCurrent;
        private Integer progressTotal;
        private String progressUnit;
        private String note;
        private String review;
        private String reviewSpoiler;
        /**
         * Поле копий версии 1: до разделения (V13) заметка и отзыв были одним столбцом
         * {@code comment}. Читается как приватная заметка — публиковать чужой текст задним
         * числом хуже, чем оставить его закрытым.
         */
        private String comment;
        private BigDecimal rating;
        private BigDecimal ratingPlot;
        private BigDecimal ratingStyle;
        private BigDecimal ratingCharacters;
        private BigDecimal ratingEnding;
        private boolean favorite;
        private boolean wishlist;
        private BigDecimal price;
        private String currency;
        private String purchaseUrl;
        private String status;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ReadingLogExport {

        private UUID id;
        private UUID itemId;
        private int attempt;
        private LocalDate startedAt;
        private LocalDate finishedAt;
        private BigDecimal rating;
        private BigDecimal ratingPlot;
        private BigDecimal ratingStyle;
        private BigDecimal ratingCharacters;
        private BigDecimal ratingEnding;
        private String comment;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ReadingSessionExport {

        private UUID id;
        private UUID itemId;
        private UUID logId;
        private LocalDate sessionDate;
        private Integer fromPosition;
        private Integer toPosition;
        private Integer durationMinutes;
        private String note;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class QuoteExport {

        private UUID id;
        private UUID itemId;
        private Integer position;
        private String text;
        private String note;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class LoanExport {

        private UUID id;
        private UUID itemId;
        private String borrowerName;
        private String borrowerContact;
        private LocalDate lentOn;
        private LocalDate dueOn;
        private LocalDate returnedOn;
        private String note;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ReviewCommentExport {

        private UUID id;
        private UUID itemId;
        private UUID authorId;
        private String body;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ReviewReactionExport {

        private UUID id;
        private UUID itemId;
        private UUID userId;
        private String kind;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class UserFollowExport {

        private UUID id;
        private UUID followerId;
        private UUID followeeId;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ActivityEventExport {

        private UUID id;
        private UUID actorId;
        private String type;
        private UUID itemId;
        private UUID shelfId;
        private String subject;
        private String detail;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class ReadingGoalExport {

        private UUID id;
        private UUID ownerId;
        private int year;
        private Integer targetItems;
        private Integer targetPages;
        private Integer targetMinutes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class UserAchievementExport {

        private UUID id;
        private UUID ownerId;
        private String code;
        private LocalDate unlockedOn;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SystemNodeExport {

        private UUID id;
        private String nodeKey;
        private String hostname;
        private String ip;
        private Integer port;
        private Double cpuLoad;
        private Long systemMemoryTotal;
        private Long systemMemoryFree;
        private Long heapUsed;
        private Long heapCommitted;
        private Long heapMax;
        private Long diskTotal;
        private Long diskFree;
        private Long uptimeSeconds;
        private OffsetDateTime lastReportedAt;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SessionExport {

        private UUID id;
        private UUID userId;
        private OffsetDateTime expiresAt;
        private OffsetDateTime maxExpiresAt;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class SessionSettingsExport {

        private Integer sessionTtlMinutes;
        private Integer maxSessionLifetimeMinutes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties( ignoreUnknown = true )
    public static class MonitoringSettingsExport {

        private Boolean metricsEnabled;
        private Integer pingIntervalSeconds;
        private String pingPath;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }
}
