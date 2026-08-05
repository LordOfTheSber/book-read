package com.library.tracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.SessionSettings;
import com.library.tracker.domain.Source;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.SessionSettingsRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.repository.SystemNodeRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class DataExportService {

    private static final DateTimeFormatter FILE_NAME_FORMATTER = DateTimeFormatter.ofPattern( "yyyy-MM-dd_HH-mm-ss" );

    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;
    private final SourceRepository sourceRepository;
    private final SessionRepository sessionRepository;
    private final SessionSettingsRepository sessionSettingsRepository;
    private final SystemNodeRepository systemNodeRepository;

    @org.springframework.beans.factory.annotation.Value( "${export.directory:exports}" )
    private String exportDirectory;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional( readOnly = true )
    public ExportResult exportData() {
        OffsetDateTime exportedAt = OffsetDateTime.now( ZoneOffset.UTC );
        ExportPayload payload = ExportPayload.builder()
                                             .exportedAt( exportedAt )
                                             .users( mapUsers() )
                                             .libraryItems( mapLibraryItems() )
                                             .bookTypes( mapBookTypes() )
                                             .sources( mapSources() )
                                             .sessionSettings( mapSessionSettings() )
                                             .build();

        Path directory = resolveExportDirectory();
        String fileName = "export-" + FILE_NAME_FORMATTER.format( exportedAt ) + ".json";
        Path filePath = directory.resolve( fileName );
        try {
            Files.createDirectories( directory );
            objectMapper.writerWithDefaultPrettyPrinter().writeValue( filePath.toFile(), payload );
            return ExportResult.builder()
                               .fileName( fileName )
                               .path( filePath.toAbsolutePath().toString() )
                               .exportedAt( exportedAt )
                               .usersCount( payload.getUsers().size() )
                               .itemsCount( payload.getLibraryItems().size() )
                               .bookTypesCount( payload.getBookTypes().size() )
                               .sourcesCount( payload.getSources().size() )
                               .sessionsCount( 0 )
                               .systemNodesCount( 0 )
                               .build();
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось сохранить данные в файл", ex );
        }
    }

    @Transactional( readOnly = true )
    public List<ExportFileInfo> listExports() {
        Path directory = resolveExportDirectory();
        if ( !Files.isDirectory( directory ) ) {
            return List.of();
        }
        try ( var stream = Files.list( directory ) ) {
            return stream.filter( path -> path.getFileName().toString().endsWith( ".json" ) )
                         .map( path -> ExportFileInfo.builder()
                                                     .fileName( path.getFileName().toString() )
                                                     .sizeBytes( path.toFile().length() )
                                                     .lastModifiedAt( OffsetDateTime.ofInstant(
                                                             java.time.Instant.ofEpochMilli(
                                                                     path.toFile().lastModified() ),
                                                             ZoneOffset.UTC ) )
                                                     .build() )
                         .sorted( Comparator.comparing( ExportFileInfo::getLastModifiedAt ).reversed() )
                         .toList();
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось получить список экспортов", ex );
        }
    }

    public void deleteExport( String fileName ) {
        String sanitized = sanitizeFileName( fileName );
        Path path = resolveExportDirectory().resolve( sanitized );
        try {
            Files.deleteIfExists( path );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось удалить файл экспорта" );
        }
    }

    public ImportResult importData( String fileName ) {
        ExportFile exportFile = resolveFile( fileName )
                .orElseThrow( () -> new IllegalArgumentException( "Файл не найден" ) );
        ExportPayload payload;
        try {
            payload = objectMapper.readValue( exportFile.getContent(), ExportPayload.class );
        } catch ( IOException ex ) {
            throw new IllegalArgumentException( "Некорректный формат файла экспорта" );
        }

        clearExistingData();

        Map<UUID, User> users = saveUsers( payload );
        Map<UUID, BookType> types = saveBookTypes( payload );
        Map<UUID, Source> sources = saveSources( payload );
        saveSessionSettings( payload );
        long restoredItems = saveLibraryItems( payload, users, types, sources );

        return ImportResult.builder()
                           .fileName( fileName )
                           .restoredUsers( users.size() )
                           .restoredItems( restoredItems )
                           .restoredBookTypes( types.size() )
                           .restoredSources( sources.size() )
                           .restoredSystemNodes( 0 )
                           .restoredSessions( 0 )
                           .build();
    }

    @Transactional( readOnly = true )
    public Optional<Path> findLatestExport() {
        Path directory = resolveExportDirectory();
        if ( !Files.isDirectory( directory ) ) {
            return Optional.empty();
        }
        try ( var stream = Files.list( directory ) ) {
            return stream.filter( path -> path.getFileName().toString().endsWith( ".json" ) )
                         .max( Comparator.comparingLong( path -> path.toFile().lastModified() ) );
        } catch ( IOException ex ) {
            log.warn( "Failed to list export directory", ex );
            return Optional.empty();
        }
    }

    @Transactional( readOnly = true )
    public Optional<ExportFile> resolveFile( String fileName ) {
        if ( !StringUtils.hasText( fileName ) ) {
            return Optional.empty();
        }
        String sanitized = Paths.get( fileName ).getFileName().toString();
        if ( !sanitized.endsWith( ".json" ) ) {
            return Optional.empty();
        }
        Path path = resolveExportDirectory().resolve( sanitized );
        if ( !Files.exists( path ) ) {
            return Optional.empty();
        }
        try {
            byte[] content = Files.readAllBytes( path );
            return Optional.of( new ExportFile( sanitized, MediaType.APPLICATION_JSON_VALUE, content ) );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось прочитать файл экспорта", ex );
        }
    }

    private Path resolveExportDirectory() {
        String directory = StringUtils.hasText( exportDirectory ) ? exportDirectory.trim() : "exports";
        return Paths.get( directory );
    }

    private String sanitizeFileName( String fileName ) {
        return Paths.get( fileName ).getFileName().toString();
    }

    private void clearExistingData() {
        sessionRepository.deleteAll();
        libraryItemRepository.deleteAll();
        bookTypeRepository.deleteAll();
        sourceRepository.deleteAll();
        userRepository.deleteAll();
        systemNodeRepository.deleteAll();
        sessionSettingsRepository.deleteAll();
        entityManager.flush();
        entityManager.clear();
    }

    private Map<UUID, User> saveUsers( ExportPayload payload ) {
        if ( payload.getUsers() == null ) {
            return Map.of();
        }
        Map<UUID, User> users = payload.getUsers()
                                        .stream()
                                        .map( dto -> {
                                            User existing = entityManager.find( User.class, dto.getId() );
                                            LocalDateTime createdAt = dto.getCreatedAt() != null
                                                    ? dto.getCreatedAt().toLocalDateTime()
                                                    : LocalDateTime.now( ZoneOffset.UTC );
                                            LocalDateTime updatedAt = dto.getUpdatedAt() != null
                                                    ? dto.getUpdatedAt().toLocalDateTime()
                                                    : createdAt;
                                            if ( existing == null ) {
                                                entityManager.createNativeQuery(
                                                                """
                                                                        INSERT INTO users (id, username, password, role, avatar, avatar_content_type, session_ttl_override_minutes, max_session_lifetime_override_minutes, blocked, created_at, updated_at)
                                                                        VALUES (:id, :username, :password, :role, :avatar, :avatarContentType, :sessionTtlOverrideMinutes, :maxSessionLifetimeOverrideMinutes, :blocked, :createdAt, :updatedAt)
                                                                        """ )
                                                             .setParameter( "id", dto.getId() )
                                                             .setParameter( "username", dto.getUsername() )
                                                             .setParameter( "password", dto.getPassword() )
                                                             .setParameter( "role", ( dto.getRole() != null ? dto.getRole() : Role.USER ).name() )
                                                             .setParameter( "avatar", decode( dto.getAvatarBase64() ) )
                                                             .setParameter( "avatarContentType", dto.getAvatarContentType() )
                                                             .setParameter( "sessionTtlOverrideMinutes", dto.getSessionTtlOverrideMinutes() )
                                                             .setParameter( "maxSessionLifetimeOverrideMinutes", dto.getMaxSessionLifetimeOverrideMinutes() )
                                                             .setParameter( "blocked", dto.isBlocked() )
                                                             .setParameter( "createdAt", createdAt )
                                                             .setParameter( "updatedAt", updatedAt )
                                                             .executeUpdate();
                                                return entityManager.find( User.class, dto.getId() );
                                            }
                                            existing.setUsername( dto.getUsername() );
                                            existing.setPassword( dto.getPassword() );
                                            existing.setRole( dto.getRole() != null ? dto.getRole() : Role.USER );
                                            existing.setBlocked( dto.isBlocked() );
                                            existing.setAvatar( decode( dto.getAvatarBase64() ) );
                                            existing.setAvatarContentType( dto.getAvatarContentType() );
                                            existing.setSessionTtlOverrideMinutes( dto.getSessionTtlOverrideMinutes() );
                                            existing.setMaxSessionLifetimeOverrideMinutes( dto.getMaxSessionLifetimeOverrideMinutes() );
                                            existing.setCreatedAt( createdAt );
                                            existing.setUpdatedAt( updatedAt );
                                            return existing;
                                        } )
                                        .collect( Collectors.toMap( User::getId, user -> user ) );
        entityManager.flush();
        return users;
    }

    private Map<UUID, BookType> saveBookTypes( ExportPayload payload ) {
        if ( payload.getBookTypes() == null ) {
            return Map.of();
        }
        Map<UUID, BookType> saved = payload.getBookTypes().stream().map( dto -> {
            BookType type = entityManager.find( BookType.class, dto.getId() );
            LocalDateTime createdAt = dto.getCreatedAt() != null
                    ? dto.getCreatedAt().toLocalDateTime()
                    : LocalDateTime.now( ZoneOffset.UTC );
            LocalDateTime updatedAt = dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : createdAt;
            if ( type == null ) {
                entityManager.createNativeQuery(
                                """
                                        INSERT INTO book_types (id, name, created_at, updated_at)
                                        VALUES (:id, :name, :createdAt, :updatedAt)
                                        """ )
                             .setParameter( "id", dto.getId() )
                             .setParameter( "name", dto.getName() )
                             .setParameter( "createdAt", createdAt )
                             .setParameter( "updatedAt", updatedAt )
                             .executeUpdate();
                return entityManager.find( BookType.class, dto.getId() );
            }
            type.setName( dto.getName() );
            type.setCreatedAt( createdAt );
            type.setUpdatedAt( updatedAt );
            return type;
        } ).collect( Collectors.toMap( BookType::getId, t -> t ) );
        entityManager.flush();
        return saved;
    }

    private Map<UUID, Source> saveSources( ExportPayload payload ) {
        if ( payload.getSources() == null ) {
            return Map.of();
        }
        Map<UUID, Source> saved = payload.getSources().stream().map( dto -> {
            Source source = entityManager.find( Source.class, dto.getId() );
            LocalDateTime createdAt = dto.getCreatedAt() != null
                    ? dto.getCreatedAt().toLocalDateTime()
                    : LocalDateTime.now( ZoneOffset.UTC );
            LocalDateTime updatedAt = dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : createdAt;
            if ( source == null ) {
                entityManager.createNativeQuery(
                                """
                                        INSERT INTO sources (id, name, url, description, created_at, updated_at)
                                        VALUES (:id, :name, :url, :description, :createdAt, :updatedAt)
                                        """ )
                             .setParameter( "id", dto.getId() )
                             .setParameter( "name", dto.getName() )
                             .setParameter( "url", dto.getUrl() )
                             .setParameter( "description", dto.getDescription() )
                             .setParameter( "createdAt", createdAt )
                             .setParameter( "updatedAt", updatedAt )
                             .executeUpdate();
                return entityManager.find( Source.class, dto.getId() );
            }
            source.setName( dto.getName() );
            source.setUrl( dto.getUrl() );
            source.setDescription( dto.getDescription() );
            source.setCreatedAt( createdAt );
            source.setUpdatedAt( updatedAt );
            return source;
        } ).collect( Collectors.toMap( Source::getId, s -> s ) );
        entityManager.flush();
        return saved;
    }

    private void saveSessionSettings( ExportPayload payload ) {
        SessionSettingsExport settingsExport = payload.getSessionSettings();
        SessionSettings settings = new SessionSettings();
        settings.setId( 1L );
        if ( settingsExport != null ) {
            settings.setSessionTtlMinutes( settingsExport.getSessionTtlMinutes() );
            settings.setMaxSessionLifetimeMinutes( settingsExport.getMaxSessionLifetimeMinutes() );
            settings.setCreatedAt( settingsExport.getCreatedAt() != null ? settingsExport.getCreatedAt().toLocalDateTime()
                                                                        : null );
            settings.setUpdatedAt( settingsExport.getUpdatedAt() != null ? settingsExport.getUpdatedAt().toLocalDateTime()
                                                                        : null );
        } else {
            settings.setSessionTtlMinutes( 30 );
            settings.setMaxSessionLifetimeMinutes( 24 * 60 );
        }
        entityManager.merge( settings );
        entityManager.flush();
    }

    private long saveLibraryItems(
            ExportPayload payload,
            Map<UUID, User> users,
            Map<UUID, BookType> types,
            Map<UUID, Source> sources
                                  ) {
        if ( payload.getLibraryItems() == null ) {
            return 0;
        }
        payload.getLibraryItems().forEach( dto -> {
            LibraryItem item = entityManager.find( LibraryItem.class, dto.getId() );
            LocalDateTime createdAt = dto.getCreatedAt() != null
                    ? dto.getCreatedAt().toLocalDateTime()
                    : LocalDateTime.now( ZoneOffset.UTC );
            LocalDateTime updatedAt = dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : createdAt;
            if ( item == null ) {
                entityManager.createNativeQuery(
                                """
                                        INSERT INTO library_items (id, kind, title, alt_title, type_id, source_id, created_by, note, review, review_spoiler, rating, favorite, status, created_at, updated_at)
                                        VALUES (:id, :kind, :title, :altTitle, :typeId, :sourceId, :createdById, :note, :review, :reviewSpoiler, :rating, :favorite, :status, :createdAt, :updatedAt)
                                        """ )
                             .setParameter( "id", dto.getId() )
                             .setParameter( "kind", dto.getKind().name() )
                             .setParameter( "title", dto.getTitle() )
                             .setParameter( "altTitle", dto.getAltTitle() )
                             .setParameter( "typeId", dto.getTypeId() )
                             .setParameter( "sourceId", dto.getSourceId() )
                             .setParameter( "createdById", dto.getCreatedById() )
                             .setParameter( "note", resolveNote( dto ) )
                             .setParameter( "review", dto.getReview() )
                             .setParameter( "reviewSpoiler", dto.getReviewSpoiler() )
                             .setParameter( "rating", dto.getRating() )
                             .setParameter( "favorite", dto.isFavorite() )
                             .setParameter( "status", dto.getStatus().name() )
                             .setParameter( "createdAt", createdAt )
                             .setParameter( "updatedAt", updatedAt )
                             .executeUpdate();
                item = entityManager.find( LibraryItem.class, dto.getId() );
            }
            item.setKind( dto.getKind() );
            item.setTitle( dto.getTitle() );
            item.setAltTitle( dto.getAltTitle() );
            item.setType( dto.getTypeId() != null ? types.get( dto.getTypeId() ) : null );
            item.setSource( dto.getSourceId() != null ? sources.get( dto.getSourceId() ) : null );
            item.setCreatedBy( dto.getCreatedById() != null ? users.get( dto.getCreatedById() ) : null );
            item.setNote( resolveNote( dto ) );
            item.setReview( dto.getReview() );
            item.setReviewSpoiler( dto.getReviewSpoiler() );
            item.setRating( dto.getRating() );
            item.setFavorite( dto.isFavorite() );
            item.setStatus( dto.getStatus() );
            item.setCreatedAt( createdAt );
            item.setUpdatedAt( updatedAt );
        } );
        entityManager.flush();
        return payload.getLibraryItems().size();
    }

    /**
     * Старые выгрузки не знают о разделении: их {@code comment} всегда писался «для себя»,
     * поэтому восстанавливается как приватная заметка, а не как публичный отзыв.
     */
    private String resolveNote( LibraryItemExport dto ) {
        return dto.getNote() != null ? dto.getNote() : dto.getComment();
    }

    private List<UserExport> mapUsers() {
        return userRepository.findAll()
                             .stream()
                             .map( user -> UserExport.builder()
                                                     .id( user.getId() )
                                                     .username( user.getUsername() )
                                                     .password( user.getPassword() )
                                                     .role( user.getRole() )
                                                     .blocked( user.isBlocked() )
                                                     .avatarBase64( encode( user.getAvatar() ) )
                                                     .avatarContentType( user.getAvatarContentType() )
                                                     .sessionTtlOverrideMinutes( user.getSessionTtlOverrideMinutes() )
                                                     .maxSessionLifetimeOverrideMinutes(
                                                             user.getMaxSessionLifetimeOverrideMinutes() )
                                                     .createdAt( toOffsetDateTime( user.getCreatedAt() ) )
                                                     .updatedAt( toOffsetDateTime( user.getUpdatedAt() ) )
                                                     .build() )
                             .toList();
    }

    private List<LibraryItemExport> mapLibraryItems() {
        return libraryItemRepository.findAll()
                                    .stream()
                                    .map( item -> LibraryItemExport.builder()
                                                                   .id( item.getId() )
                                                                   .kind( item.getKind() )
                                                                   .title( item.getTitle() )
                                                                   .altTitle( item.getAltTitle() )
                                                                   .typeId( item.getType() != null ? item.getType().getId() : null )
                                                                   .typeName( item.getType() != null ? item.getType().getName() : null )
                                                                   .sourceId( item.getSource() != null
                                                                           ? item.getSource().getId()
                                                                           : null )
                                                                   .sourceName( item.getSource() != null
                                                                           ? item.getSource().getName()
                                                                           : null )
                                                                   .createdById( item.getCreatedBy() != null
                                                                           ? item.getCreatedBy().getId()
                                                                           : null )
                                                                   .note( item.getNote() )
                                                                   .review( item.getReview() )
                                                                   .reviewSpoiler( item.getReviewSpoiler() )
                                                                   .rating( item.getRating() )
                                                                   .favorite( item.isFavorite() )
                                                                   .status( item.getStatus() )
                                                                   .createdAt( toOffsetDateTime( item.getCreatedAt() ) )
                                                                   .updatedAt( toOffsetDateTime( item.getUpdatedAt() ) )
                                                                   .build() )
                                    .toList();
    }

    private List<BookTypeExport> mapBookTypes() {
        return bookTypeRepository.findAll()
                                 .stream()
                                 .map( type -> BookTypeExport.builder()
                                                             .id( type.getId() )
                                                             .name( type.getName() )
                                                             .createdAt( toOffsetDateTime( type.getCreatedAt() ) )
                                                             .updatedAt( toOffsetDateTime( type.getUpdatedAt() ) )
                                                             .build() )
                                 .toList();
    }

    private List<SourceExport> mapSources() {
        return sourceRepository.findAll()
                               .stream()
                               .map( source -> SourceExport.builder()
                                                           .id( source.getId() )
                                                           .name( source.getName() )
                                                           .url( source.getUrl() )
                                                           .description( source.getDescription() )
                                                           .createdAt( toOffsetDateTime( source.getCreatedAt() ) )
                                                           .updatedAt( toOffsetDateTime( source.getUpdatedAt() ) )
                                                           .build() )
                               .toList();
    }

    private SessionSettingsExport mapSessionSettings() {
        return sessionSettingsRepository.findById( 1L )
                                        .map( settings -> SessionSettingsExport.builder()
                                                                               .sessionTtlMinutes(
                                                                                       settings.getSessionTtlMinutes() )
                                                                               .maxSessionLifetimeMinutes(
                                                                                       settings.getMaxSessionLifetimeMinutes() )
                                                                               .createdAt(
                                                                                       toOffsetDateTime(
                                                                                               settings.getCreatedAt() ) )
                                                                               .updatedAt(
                                                                                       toOffsetDateTime(
                                                                                               settings.getUpdatedAt() ) )
                                                                               .build() )
                                        .orElse( null );
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }

    private String encode( byte[] content ) {
        return content != null ? Base64.getEncoder().encodeToString( content ) : null;
    }

    private byte[] decode( String content ) {
        return content != null ? Base64.getDecoder().decode( content ) : null;
    }

    @lombok.Value
    @Builder
    public static class ExportResult {

        String fileName;
        String path;
        OffsetDateTime exportedAt;
        long usersCount;
        long itemsCount;
        long bookTypesCount;
        long sourcesCount;
        long sessionsCount;
        long systemNodesCount;
    }

    @lombok.Value
    public static class ExportFile {

        String fileName;
        String contentType;
        byte[] content;
    }

    @lombok.Value
    @Builder
    public static class ExportFileInfo {

        String fileName;
        long sizeBytes;
        OffsetDateTime lastModifiedAt;
    }

    @lombok.Value
    @Builder
    public static class ImportResult {

        String fileName;
        long restoredUsers;
        long restoredItems;
        long restoredBookTypes;
        long restoredSources;
        long restoredSystemNodes;
        long restoredSessions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class ExportPayload {

        private OffsetDateTime exportedAt;
        private List<UserExport> users;
        private List<LibraryItemExport> libraryItems;
        private List<BookTypeExport> bookTypes;
        private List<SourceExport> sources;
        private SessionSettingsExport sessionSettings;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class UserExport {

        private UUID id;
        private String username;
        private String password;
        private Role role;
        private boolean blocked;
        private String avatarBase64;
        private String avatarContentType;
        private Integer sessionTtlOverrideMinutes;
        private Integer maxSessionLifetimeOverrideMinutes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class LibraryItemExport {

        private UUID id;
        private com.library.tracker.domain.MediaKind kind;
        private String title;
        private String altTitle;
        private UUID typeId;
        private String typeName;
        private UUID sourceId;
        private String sourceName;
        private UUID createdById;
        private java.math.BigDecimal rating;
        private boolean favorite;
        private com.library.tracker.domain.ReadingStatus status;
        private String note;
        private String review;
        private String reviewSpoiler;
        /** Поле старых выгрузок: до разделения заметки и отзыва всё лежало здесь. */
        private String comment;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class BookTypeExport {

        private UUID id;
        private String name;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class SourceExport {

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
    private static class SessionSettingsExport {

        private Integer sessionTtlMinutes;
        private Integer maxSessionLifetimeMinutes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

}
