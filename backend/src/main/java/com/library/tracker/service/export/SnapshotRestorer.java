package com.library.tracker.service.export;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.SavedFilter;
import com.library.tracker.domain.ShelfRole;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Восстановление базы из {@link ExportPayload}. Обратная операция — {@link SnapshotCollector}.
 * <p>
 * Записи вставляются напрямую SQL-ом, а не через JPA, ради идентификаторов: у сущностей
 * {@code @GeneratedValue}, и {@code persist} выдал бы им новые ключи, порвав все ссылки внутри
 * копии. Идентификатор здесь — часть данных, а не деталь хранения: по нему связаны и полки,
 * и заходы чтения, и лента.
 * <p>
 * Порядок вставки повторяет порядок внешних ключей, а не разделов файла. Перед вставкой база
 * очищается целиком: восстановление заменяет состояние, а не дополняет его.
 * <p>
 * Файл может быть старым, снятым другой версией или поправленным руками, поэтому ссылка,
 * которой некуда указать, не роняет восстановление: обязательная — запись пропускается,
 * необязательная — обнуляется. И то и другое пишется в лог. Нарушение же уникальности
 * (два пользователя с одним логином) не глушится: такую копию лучше отвергнуть целиком,
 * чем молча восстановить наполовину.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SnapshotRestorer {

    /**
     * Очистка идёт снизу вверх по внешним ключам. Каскады на большинстве связей есть, но
     * полагаться на них — значит зависеть от того, какую таблицу удалили первой.
     */
    private static final List<String> TABLES_TO_CLEAR = List.of(
            "activity_events",
            "review_comments",
            "review_reactions",
            "user_follows",
            "user_achievements",
            "reading_goals",
            "loans",
            "quotes",
            "reading_sessions",
            "reading_logs",
            "shelf_members",
            "shelf_items",
            "library_item_tags",
            "library_item_authors",
            "smart_shelves",
            "shelves",
            "tags",
            "sessions",
            "library_items",
            "series",
            "authors",
            "sources",
            "book_types",
            "users",
            "system_nodes",
            "session_settings",
            "monitoring_settings" );

    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * @return число восстановленных записей по разделам; ключи те же, что имена разделов файла.
     */
    public Map<String, Long> restore( ExportPayload payload ) {
        Counters counters = new Counters();

        clear();

        Set<UUID> users = restoreUsers( payload, counters );
        Set<UUID> bookTypes = restoreBookTypes( payload, counters );
        Set<UUID> sources = restoreSources( payload, counters );
        Set<UUID> authors = restoreAuthors( payload, counters );
        Set<UUID> series = restoreSeries( payload, counters );
        Set<UUID> tags = restoreTags( payload, users, counters );
        Set<UUID> shelves = restoreShelves( payload, users, counters );
        restoreSmartShelves( payload, users, counters );
        Set<UUID> items = restoreLibraryItems( payload, users, bookTypes, sources, series, counters );

        restoreItemAuthors( payload, items, authors, counters );
        restoreItemTags( payload, items, tags, counters );
        restoreShelfItems( payload, shelves, items, counters );
        restoreShelfMembers( payload, shelves, users, counters );

        Set<UUID> logs = restoreReadingLogs( payload, items, counters );
        restoreReadingSessions( payload, items, logs, counters );
        restoreQuotes( payload, items, counters );
        restoreLoans( payload, items, counters );
        restoreReviewComments( payload, items, users, counters );
        restoreReviewReactions( payload, items, users, counters );
        restoreUserFollows( payload, users, counters );
        restoreActivityEvents( payload, users, items, shelves, counters );
        restoreReadingGoals( payload, users, counters );
        restoreUserAchievements( payload, users, counters );
        restoreSessions( payload, users, counters );
        restoreSystemNodes( payload, counters );
        restoreSessionSettings( payload, counters );
        restoreMonitoringSettings( payload, counters );

        // Контекст держит сущности, удалённые запросами выше: без очистки следующее чтение
        // в той же транзакции вернуло бы то, чего в базе уже нет.
        entityManager.flush();
        entityManager.clear();

        return counters.values();
    }

    private void clear() {
        entityManager.flush();
        entityManager.clear();
        for ( String table : TABLES_TO_CLEAR ) {
            entityManager.createNativeQuery( "DELETE FROM " + table ).executeUpdate();
        }
    }

    private Set<UUID> restoreUsers( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.UserExport dto : each( payload.getUsers() ) ) {
            if ( !accept( dto.getId(), restored, "users" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO users (id, username, password, role, avatar, avatar_content_type,
                                               session_ttl_override_minutes, max_session_lifetime_override_minutes,
                                               blocked, display_name, bio, public_profile, created_at, updated_at)
                            VALUES (:id, :username, :password, :role, :avatar, :avatarContentType,
                                    :sessionTtl, :maxSessionLifetime,
                                    :blocked, :displayName, :bio, :publicProfile, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "username", dto.getUsername() )
                    .setParameter( "password", dto.getPassword() )
                    .setParameter( "role", constant( Role.class, dto.getRole(), Role.USER ) )
                    .setParameter( "avatar", decode( dto.getAvatarBase64() ) )
                    .setParameter( "avatarContentType", dto.getAvatarContentType() )
                    .setParameter( "sessionTtl", dto.getSessionTtlOverrideMinutes() )
                    .setParameter( "maxSessionLifetime", dto.getMaxSessionLifetimeOverrideMinutes() )
                    .setParameter( "blocked", dto.isBlocked() )
                    .setParameter( "displayName", dto.getDisplayName() )
                    .setParameter( "bio", dto.getBio() )
                    // Копии версии 1 профилей не знали; закрытый профиль — безопасное умолчание.
                    .setParameter( "publicProfile", Boolean.TRUE.equals( dto.getPublicProfile() ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "users" );
        }
        return restored;
    }

    private Set<UUID> restoreBookTypes( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.BookTypeExport dto : each( payload.getBookTypes() ) ) {
            if ( !accept( dto.getId(), restored, "bookTypes" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO book_types (id, name, created_at, updated_at)
                            VALUES (:id, :name, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "bookTypes" );
        }
        return restored;
    }

    private Set<UUID> restoreSources( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.SourceExport dto : each( payload.getSources() ) ) {
            if ( !accept( dto.getId(), restored, "sources" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO sources (id, name, url, description, created_at, updated_at)
                            VALUES (:id, :name, :url, :description, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "name", dto.getName() )
                    // Колонка NOT NULL, а у ссылки без адреса восстановление падало бы целиком.
                    .setParameter( "url", dto.getUrl() != null ? dto.getUrl() : "" )
                    .setParameter( "description", dto.getDescription() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "sources" );
        }
        return restored;
    }

    private Set<UUID> restoreAuthors( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.AuthorExport dto : each( payload.getAuthors() ) ) {
            if ( !accept( dto.getId(), restored, "authors" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO authors (id, name, alt_name, created_at, updated_at)
                            VALUES (:id, :name, :altName, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "altName", dto.getAltName() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "authors" );
        }
        return restored;
    }

    private Set<UUID> restoreSeries( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.SeriesExport dto : each( payload.getSeries() ) ) {
            if ( !accept( dto.getId(), restored, "series" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO series (id, name, description, created_at, updated_at)
                            VALUES (:id, :name, :description, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "description", dto.getDescription() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "series" );
        }
        return restored;
    }

    private Set<UUID> restoreTags( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.TagExport dto : each( payload.getTags() ) ) {
            if ( !accept( dto.getId(), restored, "tags" ) || !required( dto.getOwnerId(), users, "tags", "ownerId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO tags (id, owner_id, name, color, created_at, updated_at)
                            VALUES (:id, :ownerId, :name, :color, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "ownerId", dto.getOwnerId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "color", dto.getColor() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "tags" );
        }
        return restored;
    }

    private Set<UUID> restoreShelves( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ShelfExport dto : each( payload.getShelves() ) ) {
            if ( !accept( dto.getId(), restored, "shelves" )
                 || !required( dto.getOwnerId(), users, "shelves", "ownerId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO shelves (id, owner_id, name, description, is_public, created_at, updated_at)
                            VALUES (:id, :ownerId, :name, :description, :isPublic, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "ownerId", dto.getOwnerId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "description", dto.getDescription() )
                    .setParameter( "isPublic", dto.isPublicShelf() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "shelves" );
        }
        return restored;
    }

    private void restoreSmartShelves( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.SmartShelfExport dto : each( payload.getSmartShelves() ) ) {
            if ( !accept( dto.getId(), restored, "smartShelves" )
                 || !required( dto.getOwnerId(), users, "smartShelves", "ownerId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO smart_shelves (id, owner_id, name, description, filter, created_at, updated_at)
                            VALUES (:id, :ownerId, :name, :description, CAST(:filter AS jsonb), :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "ownerId", dto.getOwnerId() )
                    .setParameter( "name", dto.getName() )
                    .setParameter( "description", dto.getDescription() )
                    .setParameter( "filter", filterJson( dto.getFilter() ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "smartShelves" );
        }
    }

    private Set<UUID> restoreLibraryItems( ExportPayload payload,
                                           Set<UUID> users,
                                           Set<UUID> bookTypes,
                                           Set<UUID> sources,
                                           Set<UUID> series,
                                           Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.LibraryItemExport dto : each( payload.getLibraryItems() ) ) {
            if ( !accept( dto.getId(), restored, "libraryItems" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO library_items (id, kind, title, alt_title, type_id, source_id, created_by,
                                                       series_id, order_in_series, isbn, published_year, language,
                                                       page_count, translator, cover_key, cover_content_type, format,
                                                       bookcase, shelf, started_at, finished_at, deadline,
                                                       progress_current, progress_total, progress_unit,
                                                       note, review, review_spoiler, rating, rating_plot, rating_style,
                                                       rating_characters, rating_ending, favorite, wishlist,
                                                       price, currency, purchase_url, status, created_at, updated_at)
                            VALUES (:id, :kind, :title, :altTitle, :typeId, :sourceId, :createdById,
                                    :seriesId, :orderInSeries, :isbn, :publishedYear, :language,
                                    :pageCount, :translator, :coverKey, :coverContentType, :format,
                                    :bookcase, :shelf, :startedAt, :finishedAt, :deadline,
                                    :progressCurrent, :progressTotal, :progressUnit,
                                    :note, :review, :reviewSpoiler, :rating, :ratingPlot, :ratingStyle,
                                    :ratingCharacters, :ratingEnding, :favorite, :wishlist,
                                    :price, :currency, :purchaseUrl, :status, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "kind", constant( MediaKind.class, dto.getKind(), MediaKind.BOOK ) )
                    .setParameter( "title", dto.getTitle() )
                    .setParameter( "altTitle", dto.getAltTitle() )
                    .setParameter( "typeId", optional( dto.getTypeId(), bookTypes, "libraryItems", "typeId" ) )
                    .setParameter( "sourceId", optional( dto.getSourceId(), sources, "libraryItems", "sourceId" ) )
                    .setParameter( "createdById", optional( dto.getCreatedById(), users, "libraryItems", "createdById" ) )
                    .setParameter( "seriesId", optional( dto.getSeriesId(), series, "libraryItems", "seriesId" ) )
                    .setParameter( "orderInSeries", dto.getOrderInSeries() )
                    .setParameter( "isbn", dto.getIsbn() )
                    .setParameter( "publishedYear", dto.getPublishedYear() )
                    .setParameter( "language", dto.getLanguage() )
                    .setParameter( "pageCount", dto.getPageCount() )
                    .setParameter( "translator", dto.getTranslator() )
                    .setParameter( "coverKey", dto.getCoverKey() )
                    .setParameter( "coverContentType", dto.getCoverContentType() )
                    .setParameter( "format", constant( ItemFormat.class, dto.getFormat(), null ) )
                    .setParameter( "bookcase", dto.getBookcase() )
                    .setParameter( "shelf", dto.getShelfLabel() )
                    .setParameter( "startedAt", dto.getStartedAt() )
                    .setParameter( "finishedAt", dto.getFinishedAt() )
                    .setParameter( "deadline", dto.getDeadline() )
                    .setParameter( "progressCurrent", dto.getProgressCurrent() )
                    .setParameter( "progressTotal", dto.getProgressTotal() )
                    .setParameter( "progressUnit", constant( ProgressUnit.class, dto.getProgressUnit(), null ) )
                    .setParameter( "note", note( dto ) )
                    .setParameter( "review", dto.getReview() )
                    .setParameter( "reviewSpoiler", dto.getReviewSpoiler() )
                    .setParameter( "rating", dto.getRating() )
                    .setParameter( "ratingPlot", dto.getRatingPlot() )
                    .setParameter( "ratingStyle", dto.getRatingStyle() )
                    .setParameter( "ratingCharacters", dto.getRatingCharacters() )
                    .setParameter( "ratingEnding", dto.getRatingEnding() )
                    .setParameter( "favorite", dto.isFavorite() )
                    .setParameter( "wishlist", dto.isWishlist() )
                    .setParameter( "price", dto.getPrice() )
                    .setParameter( "currency", dto.getCurrency() )
                    .setParameter( "purchaseUrl", dto.getPurchaseUrl() )
                    .setParameter( "status", constant( ReadingStatus.class, dto.getStatus(), ReadingStatus.PLANNED ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "libraryItems" );
        }
        return restored;
    }

    /**
     * Заметка копий версии 1 лежала в {@code comment}: до разделения (V13) заметка и отзыв были
     * одним полем. Читается как приватная заметка — публиковать чужой текст задним числом хуже,
     * чем оставить его закрытым.
     */
    private String note( ExportPayload.LibraryItemExport dto ) {
        return dto.getNote() != null ? dto.getNote() : dto.getComment();
    }

    private void restoreItemAuthors( ExportPayload payload, Set<UUID> items, Set<UUID> authors, Counters counters ) {
        // Повтор записи в файле уже пропущен при вставке произведений; здесь его надо пропустить
        // ещё раз, иначе пара «произведение — автор» пришла бы дважды на первичный ключ связи.
        Set<UUID> linked = new HashSet<>();
        for ( ExportPayload.LibraryItemExport dto : each( payload.getLibraryItems() ) ) {
            if ( !items.contains( dto.getId() ) || !linked.add( dto.getId() ) ) {
                continue;
            }
            for ( UUID authorId : distinct( dto.getAuthorIds() ) ) {
                if ( !required( authorId, authors, "libraryItems", "authorIds" ) ) {
                    continue;
                }
                insert( """
                                INSERT INTO library_item_authors (item_id, author_id) VALUES (:itemId, :authorId)
                                """ )
                        .setParameter( "itemId", dto.getId() )
                        .setParameter( "authorId", authorId )
                        .executeUpdate();
                counters.count( "itemAuthors" );
            }
        }
    }

    private void restoreItemTags( ExportPayload payload, Set<UUID> items, Set<UUID> tags, Counters counters ) {
        Set<UUID> linked = new HashSet<>();
        for ( ExportPayload.LibraryItemExport dto : each( payload.getLibraryItems() ) ) {
            if ( !items.contains( dto.getId() ) || !linked.add( dto.getId() ) ) {
                continue;
            }
            for ( UUID tagId : distinct( dto.getTagIds() ) ) {
                if ( !required( tagId, tags, "libraryItems", "tagIds" ) ) {
                    continue;
                }
                insert( """
                                INSERT INTO library_item_tags (item_id, tag_id) VALUES (:itemId, :tagId)
                                """ )
                        .setParameter( "itemId", dto.getId() )
                        .setParameter( "tagId", tagId )
                        .executeUpdate();
                counters.count( "itemTags" );
            }
        }
    }

    private void restoreShelfItems( ExportPayload payload, Set<UUID> shelves, Set<UUID> items, Counters counters ) {
        Set<UUID> linked = new HashSet<>();
        for ( ExportPayload.ShelfExport dto : each( payload.getShelves() ) ) {
            if ( !shelves.contains( dto.getId() ) || !linked.add( dto.getId() ) ) {
                continue;
            }
            for ( UUID itemId : distinct( dto.getItemIds() ) ) {
                if ( !required( itemId, items, "shelves", "itemIds" ) ) {
                    continue;
                }
                insert( """
                                INSERT INTO shelf_items (shelf_id, item_id) VALUES (:shelfId, :itemId)
                                """ )
                        .setParameter( "shelfId", dto.getId() )
                        .setParameter( "itemId", itemId )
                        .executeUpdate();
                counters.count( "shelfItems" );
            }
        }
    }

    private void restoreShelfMembers( ExportPayload payload, Set<UUID> shelves, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ShelfMemberExport dto : each( payload.getShelfMembers() ) ) {
            if ( !accept( dto.getId(), restored, "shelfMembers" )
                 || !required( dto.getShelfId(), shelves, "shelfMembers", "shelfId" )
                 || !required( dto.getUserId(), users, "shelfMembers", "userId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO shelf_members (id, shelf_id, user_id, role, created_at, updated_at)
                            VALUES (:id, :shelfId, :userId, :role, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "shelfId", dto.getShelfId() )
                    .setParameter( "userId", dto.getUserId() )
                    .setParameter( "role", constant( ShelfRole.class, dto.getRole(), ShelfRole.VIEWER ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "shelfMembers" );
        }
    }

    private Set<UUID> restoreReadingLogs( ExportPayload payload, Set<UUID> items, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ReadingLogExport dto : each( payload.getReadingLogs() ) ) {
            if ( !accept( dto.getId(), restored, "readingLogs" )
                 || !required( dto.getItemId(), items, "readingLogs", "itemId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO reading_logs (id, item_id, attempt, started_at, finished_at, rating,
                                                      rating_plot, rating_style, rating_characters, rating_ending,
                                                      comment, created_at, updated_at)
                            VALUES (:id, :itemId, :attempt, :startedAt, :finishedAt, :rating,
                                    :ratingPlot, :ratingStyle, :ratingCharacters, :ratingEnding,
                                    :comment, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "attempt", dto.getAttempt() )
                    .setParameter( "startedAt", dto.getStartedAt() )
                    .setParameter( "finishedAt", dto.getFinishedAt() )
                    .setParameter( "rating", dto.getRating() )
                    .setParameter( "ratingPlot", dto.getRatingPlot() )
                    .setParameter( "ratingStyle", dto.getRatingStyle() )
                    .setParameter( "ratingCharacters", dto.getRatingCharacters() )
                    .setParameter( "ratingEnding", dto.getRatingEnding() )
                    .setParameter( "comment", dto.getComment() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "readingLogs" );
        }
        return restored;
    }

    private void restoreReadingSessions( ExportPayload payload, Set<UUID> items, Set<UUID> logs, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ReadingSessionExport dto : each( payload.getReadingSessions() ) ) {
            if ( !accept( dto.getId(), restored, "readingSessions" )
                 || !required( dto.getItemId(), items, "readingSessions", "itemId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO reading_sessions (id, item_id, log_id, session_date, from_position,
                                                          to_position, duration_minutes, note, created_at, updated_at)
                            VALUES (:id, :itemId, :logId, :sessionDate, :fromPosition,
                                    :toPosition, :durationMinutes, :note, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "logId", optional( dto.getLogId(), logs, "readingSessions", "logId" ) )
                    .setParameter( "sessionDate", dto.getSessionDate() )
                    .setParameter( "fromPosition", dto.getFromPosition() )
                    .setParameter( "toPosition", dto.getToPosition() )
                    .setParameter( "durationMinutes", dto.getDurationMinutes() )
                    .setParameter( "note", dto.getNote() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "readingSessions" );
        }
    }

    private void restoreQuotes( ExportPayload payload, Set<UUID> items, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.QuoteExport dto : each( payload.getQuotes() ) ) {
            if ( !accept( dto.getId(), restored, "quotes" )
                 || !required( dto.getItemId(), items, "quotes", "itemId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO quotes (id, item_id, position, text, note, created_at, updated_at)
                            VALUES (:id, :itemId, :position, :text, :note, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "position", dto.getPosition() )
                    .setParameter( "text", dto.getText() != null ? dto.getText() : "" )
                    .setParameter( "note", dto.getNote() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "quotes" );
        }
    }

    private void restoreLoans( ExportPayload payload, Set<UUID> items, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.LoanExport dto : each( payload.getLoans() ) ) {
            if ( !accept( dto.getId(), restored, "loans" )
                 || !required( dto.getItemId(), items, "loans", "itemId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO loans (id, item_id, borrower_name, borrower_contact, lent_on, due_on,
                                               returned_on, note, created_at, updated_at)
                            VALUES (:id, :itemId, :borrowerName, :borrowerContact, :lentOn, :dueOn,
                                    :returnedOn, :note, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "borrowerName", dto.getBorrowerName() )
                    .setParameter( "borrowerContact", dto.getBorrowerContact() )
                    .setParameter( "lentOn", dto.getLentOn() )
                    .setParameter( "dueOn", dto.getDueOn() )
                    .setParameter( "returnedOn", dto.getReturnedOn() )
                    .setParameter( "note", dto.getNote() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "loans" );
        }
    }

    private void restoreReviewComments( ExportPayload payload, Set<UUID> items, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ReviewCommentExport dto : each( payload.getReviewComments() ) ) {
            if ( !accept( dto.getId(), restored, "reviewComments" )
                 || !required( dto.getItemId(), items, "reviewComments", "itemId" )
                 || !required( dto.getAuthorId(), users, "reviewComments", "authorId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO review_comments (id, item_id, author_id, body, created_at, updated_at)
                            VALUES (:id, :itemId, :authorId, :body, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "authorId", dto.getAuthorId() )
                    .setParameter( "body", dto.getBody() != null ? dto.getBody() : "" )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "reviewComments" );
        }
    }

    private void restoreReviewReactions( ExportPayload payload, Set<UUID> items, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ReviewReactionExport dto : each( payload.getReviewReactions() ) ) {
            if ( !accept( dto.getId(), restored, "reviewReactions" )
                 || !required( dto.getItemId(), items, "reviewReactions", "itemId" )
                 || !required( dto.getUserId(), users, "reviewReactions", "userId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO review_reactions (id, item_id, user_id, kind, created_at, updated_at)
                            VALUES (:id, :itemId, :userId, :kind, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "itemId", dto.getItemId() )
                    .setParameter( "userId", dto.getUserId() )
                    .setParameter( "kind", constant( ReactionKind.class, dto.getKind(), ReactionKind.LIKE ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "reviewReactions" );
        }
    }

    private void restoreUserFollows( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.UserFollowExport dto : each( payload.getUserFollows() ) ) {
            if ( !accept( dto.getId(), restored, "userFollows" )
                 || !required( dto.getFollowerId(), users, "userFollows", "followerId" )
                 || !required( dto.getFolloweeId(), users, "userFollows", "followeeId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO user_follows (id, follower_id, followee_id, created_at, updated_at)
                            VALUES (:id, :followerId, :followeeId, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "followerId", dto.getFollowerId() )
                    .setParameter( "followeeId", dto.getFolloweeId() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "userFollows" );
        }
    }

    private void restoreActivityEvents( ExportPayload payload,
                                        Set<UUID> users,
                                        Set<UUID> items,
                                        Set<UUID> shelves,
                                        Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ActivityEventExport dto : each( payload.getActivityEvents() ) ) {
            if ( !accept( dto.getId(), restored, "activityEvents" )
                 || !required( dto.getActorId(), users, "activityEvents", "actorId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO activity_events (id, actor_id, type, item_id, shelf_id, subject, detail,
                                                         created_at, updated_at)
                            VALUES (:id, :actorId, :type, :itemId, :shelfId, :subject, :detail,
                                    :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "actorId", dto.getActorId() )
                    .setParameter( "type", constant( ActivityType.class, dto.getType(), ActivityType.RATED ) )
                    .setParameter( "itemId", optional( dto.getItemId(), items, "activityEvents", "itemId" ) )
                    .setParameter( "shelfId", optional( dto.getShelfId(), shelves, "activityEvents", "shelfId" ) )
                    .setParameter( "subject", dto.getSubject() )
                    .setParameter( "detail", dto.getDetail() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "activityEvents" );
        }
    }

    private void restoreReadingGoals( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.ReadingGoalExport dto : each( payload.getReadingGoals() ) ) {
            if ( !accept( dto.getId(), restored, "readingGoals" )
                 || !required( dto.getOwnerId(), users, "readingGoals", "ownerId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO reading_goals (id, owner_id, year, target_items, target_pages, target_minutes,
                                                       created_at, updated_at)
                            VALUES (:id, :ownerId, :year, :targetItems, :targetPages, :targetMinutes,
                                    :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "ownerId", dto.getOwnerId() )
                    .setParameter( "year", dto.getYear() )
                    .setParameter( "targetItems", dto.getTargetItems() )
                    .setParameter( "targetPages", dto.getTargetPages() )
                    .setParameter( "targetMinutes", dto.getTargetMinutes() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "readingGoals" );
        }
    }

    private void restoreUserAchievements( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.UserAchievementExport dto : each( payload.getUserAchievements() ) ) {
            if ( !accept( dto.getId(), restored, "userAchievements" )
                 || !required( dto.getOwnerId(), users, "userAchievements", "ownerId" ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO user_achievements (id, owner_id, code, unlocked_on, created_at, updated_at)
                            VALUES (:id, :ownerId, :code, :unlockedOn, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "ownerId", dto.getOwnerId() )
                    .setParameter( "code", dto.getCode() )
                    .setParameter( "unlockedOn", dto.getUnlockedOn() != null
                            ? dto.getUnlockedOn()
                            : createdAt.toLocalDate() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "userAchievements" );
        }
    }

    /**
     * Сессии восстанавливаются вместе с остальным: копия — это снимок системы, а не только
     * библиотеки. Побочный эффект неизбежен и заметен сразу: тот, кто нажал «восстановить»,
     * останется в системе, только если его сессия была в копии.
     */
    private void restoreSessions( ExportPayload payload, Set<UUID> users, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        for ( ExportPayload.SessionExport dto : each( payload.getSessions() ) ) {
            if ( !accept( dto.getId(), restored, "sessions" )
                 || !required( dto.getUserId(), users, "sessions", "userId" )
                 || dto.getExpiresAt() == null || dto.getMaxExpiresAt() == null ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO sessions (id, user_id, expires_at, max_expires_at, created_at, updated_at)
                            VALUES (:id, :userId, :expiresAt, :maxExpiresAt, :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "userId", dto.getUserId() )
                    // Здесь момент времени, а не «стенные часы»: в модели это OffsetDateTime.
                    .setParameter( "expiresAt", dto.getExpiresAt() )
                    .setParameter( "maxExpiresAt", dto.getMaxExpiresAt() )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "sessions" );
        }
    }

    private void restoreSystemNodes( ExportPayload payload, Counters counters ) {
        Set<UUID> restored = new HashSet<>();
        Set<String> keys = new HashSet<>();
        for ( ExportPayload.SystemNodeExport dto : each( payload.getSystemNodes() ) ) {
            // node_key уникален, и копия с двумя записями одного узла иначе положила бы всё
            // восстановление на ограничении.
            if ( !accept( dto.getId(), restored, "systemNodes" ) || !keys.add( dto.getNodeKey() ) ) {
                continue;
            }
            LocalDateTime createdAt = created( dto.getCreatedAt() );
            insert( """
                            INSERT INTO system_nodes (id, node_key, hostname, ip, port, cpu_load, system_memory_total,
                                                      system_memory_free, heap_used, heap_committed, heap_max,
                                                      disk_total, disk_free, uptime_seconds, last_reported_at,
                                                      created_at, updated_at)
                            VALUES (:id, :nodeKey, :hostname, :ip, :port, :cpuLoad, :systemMemoryTotal,
                                    :systemMemoryFree, :heapUsed, :heapCommitted, :heapMax,
                                    :diskTotal, :diskFree, :uptimeSeconds, :lastReportedAt,
                                    :createdAt, :updatedAt)
                            """ )
                    .setParameter( "id", dto.getId() )
                    .setParameter( "nodeKey", dto.getNodeKey() )
                    .setParameter( "hostname", dto.getHostname() )
                    .setParameter( "ip", dto.getIp() )
                    .setParameter( "port", dto.getPort() )
                    .setParameter( "cpuLoad", dto.getCpuLoad() )
                    .setParameter( "systemMemoryTotal", dto.getSystemMemoryTotal() )
                    .setParameter( "systemMemoryFree", dto.getSystemMemoryFree() )
                    .setParameter( "heapUsed", dto.getHeapUsed() )
                    .setParameter( "heapCommitted", dto.getHeapCommitted() )
                    .setParameter( "heapMax", dto.getHeapMax() )
                    .setParameter( "diskTotal", dto.getDiskTotal() )
                    .setParameter( "diskFree", dto.getDiskFree() )
                    .setParameter( "uptimeSeconds", dto.getUptimeSeconds() )
                    .setParameter( "lastReportedAt", local( dto.getLastReportedAt() ) )
                    .setParameter( "createdAt", createdAt )
                    .setParameter( "updatedAt", updated( dto.getUpdatedAt(), createdAt ) )
                    .executeUpdate();
            counters.count( "systemNodes" );
        }
    }

    /**
     * Настройки — одна строка с известным ключом. Её нет в копиях, снятых до появления раздела,
     * и тогда восстанавливаются значения из миграции: без строки приложение не стартует.
     */
    private void restoreSessionSettings( ExportPayload payload, Counters counters ) {
        ExportPayload.SessionSettingsExport dto = payload.getSessionSettings();
        LocalDateTime createdAt = created( dto != null ? dto.getCreatedAt() : null );
        insert( """
                        INSERT INTO session_settings (id, session_ttl_minutes, max_session_lifetime_minutes,
                                                      created_at, updated_at)
                        VALUES (1, :ttl, :maxLifetime, :createdAt, :updatedAt)
                        """ )
                .setParameter( "ttl", positive( dto != null ? dto.getSessionTtlMinutes() : null, 30 ) )
                .setParameter( "maxLifetime", positive( dto != null ? dto.getMaxSessionLifetimeMinutes() : null, 1440 ) )
                .setParameter( "createdAt", createdAt )
                .setParameter( "updatedAt", updated( dto != null ? dto.getUpdatedAt() : null, createdAt ) )
                .executeUpdate();
        counters.count( "sessionSettings" );
    }

    private void restoreMonitoringSettings( ExportPayload payload, Counters counters ) {
        ExportPayload.MonitoringSettingsExport dto = payload.getMonitoringSettings();
        LocalDateTime createdAt = created( dto != null ? dto.getCreatedAt() : null );
        String pingPath = dto != null && StringUtils.hasText( dto.getPingPath() )
                ? dto.getPingPath()
                : "/api/v1/monitoring/ping";
        insert( """
                        INSERT INTO monitoring_settings (id, metrics_enabled, ping_interval_seconds, ping_path,
                                                         created_at, updated_at)
                        VALUES (1, :enabled, :interval, :pingPath, :createdAt, :updatedAt)
                        """ )
                .setParameter( "enabled", dto == null || !Boolean.FALSE.equals( dto.getMetricsEnabled() ) )
                .setParameter( "interval", positive( dto != null ? dto.getPingIntervalSeconds() : null, 30 ) )
                .setParameter( "pingPath", pingPath )
                .setParameter( "createdAt", createdAt )
                .setParameter( "updatedAt", updated( dto != null ? dto.getUpdatedAt() : null, createdAt ) )
                .executeUpdate();
        counters.count( "monitoringSettings" );
    }

    private Query insert( String sql ) {
        return entityManager.createNativeQuery( sql );
    }

    private <T> List<T> each( List<T> rows ) {
        return rows != null ? rows : List.of();
    }

    private List<UUID> distinct( List<UUID> ids ) {
        return ids != null ? ids.stream().filter( java.util.Objects::nonNull ).distinct().toList() : List.of();
    }

    /** Запись без идентификатора или с уже занятым идентификатором пропускается. */
    private boolean accept( UUID id, Set<UUID> restored, String section ) {
        if ( id == null ) {
            log.warn( "Восстановление: запись раздела {} без идентификатора пропущена", section );
            return false;
        }
        if ( !restored.add( id ) ) {
            log.warn( "Восстановление: повтор идентификатора {} в разделе {} пропущен", id, section );
            return false;
        }
        return true;
    }

    /** Обязательная ссылка: если цели нет, запись восстановить нельзя. */
    private boolean required( UUID reference, Set<UUID> known, String section, String field ) {
        if ( reference != null && known.contains( reference ) ) {
            return true;
        }
        log.warn( "Восстановление: {}.{} = {} указывает в пустоту, запись пропущена", section, field, reference );
        return false;
    }

    /** Необязательная ссылка: если цели нет, запись остаётся, а ссылка обнуляется. */
    private UUID optional( UUID reference, Set<UUID> known, String section, String field ) {
        if ( reference == null || known.contains( reference ) ) {
            return reference;
        }
        log.warn( "Восстановление: {}.{} = {} указывает в пустоту, связь снята", section, field, reference );
        return null;
    }

    /**
     * Значение перечисления из строки. Неизвестное значение (копия новее кода или, наоборот,
     * из версии, где такой вариант ещё был) заменяется умолчанием, а не рушит разбор файла.
     */
    private <E extends Enum<E>> String constant( Class<E> type, String raw, E fallback ) {
        if ( StringUtils.hasText( raw ) ) {
            try {
                return Enum.valueOf( type, raw.trim() ).name();
            } catch ( IllegalArgumentException ex ) {
                log.warn( "Восстановление: значение {} неизвестно для {}, взято {}", raw, type.getSimpleName(),
                          fallback );
            }
        }
        return fallback != null ? fallback.name() : null;
    }

    private String filterJson( SavedFilter filter ) {
        try {
            return objectMapper.writeValueAsString( filter != null ? filter : new SavedFilter() );
        } catch ( JsonProcessingException ex ) {
            log.warn( "Восстановление: фильтр умной полки не читается, взят пустой", ex );
            return "{}";
        }
    }

    private Integer positive( Integer value, int fallback ) {
        return value != null && value > 0 ? value : fallback;
    }

    private LocalDateTime created( OffsetDateTime createdAt ) {
        return createdAt != null ? createdAt.toLocalDateTime() : LocalDateTime.now( ZoneOffset.UTC );
    }

    private LocalDateTime updated( OffsetDateTime updatedAt, LocalDateTime createdAt ) {
        return updatedAt != null ? updatedAt.toLocalDateTime() : createdAt;
    }

    private LocalDateTime local( OffsetDateTime value ) {
        return value != null ? value.toLocalDateTime() : null;
    }

    private byte[] decode( String content ) {
        if ( !StringUtils.hasText( content ) ) {
            return null;
        }
        try {
            return Base64.getDecoder().decode( content );
        } catch ( IllegalArgumentException ex ) {
            log.warn( "Восстановление: аватар не читается как base64, пропущен" );
            return null;
        }
    }

    /** Счётчики восстановленного по разделам — в том порядке, в каком разделы восстанавливались. */
    private static final class Counters {

        private final Map<String, Long> values = new LinkedHashMap<>();

        private void count( String section ) {
            values.merge( section, 1L, Long::sum );
        }

        private Map<String, Long> values() {
            return values;
        }
    }
}
