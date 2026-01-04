package com.library.tracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Session;
import com.library.tracker.domain.SessionSettings;
import com.library.tracker.domain.Source;
import com.library.tracker.domain.SystemNode;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.SessionSettingsRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.repository.SystemNodeRepository;
import com.library.tracker.repository.UserRepository;

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
import java.util.stream.StreamSupport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value( "${export.directory:exports}" )
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
                                             .sessions( mapSessions() )
                                             .sessionSettings( mapSessionSettings() )
                                             .systemNodes( mapSystemNodes() )
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
                               .sessionsCount( payload.getSessions().size() )
                               .systemNodesCount( payload.getSystemNodes().size() )
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
        Map<UUID, SystemNode> nodes = saveSystemNodes( payload );
        saveSessionSettings( payload );
        long restoredItems = saveLibraryItems( payload, users, types, sources );
        long restoredSessions = saveSessions( payload, users );

        return ImportResult.builder()
                           .fileName( fileName )
                           .restoredUsers( users.size() )
                           .restoredItems( restoredItems )
                           .restoredBookTypes( types.size() )
                           .restoredSources( sources.size() )
                           .restoredSystemNodes( nodes.size() )
                           .restoredSessions( restoredSessions )
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
        systemNodeRepository.deleteAll();
        userRepository.deleteAll();
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
                                            User user = new User();
                                            user.setId( dto.getId() );
                                            user.setUsername( dto.getUsername() );
                                            user.setPassword( dto.getPassword() );
                                            user.setRole( dto.getRole() != null ? dto.getRole() : Role.USER );
                                            return user;
        users.replaceAll( ( id, entity ) -> entityManager.merge( entity ) );
                                           user.setAvatar( decode( dto.getAvatarBase64() ) );
                                           user.setAvatarContentType( dto.getAvatarContentType() );
                                           user.setSessionTtlOverrideMinutes( dto.getSessionTtlOverrideMinutes() );
                                           user.setMaxSessionLifetimeOverrideMinutes( dto.getMaxSessionLifetimeOverrideMinutes() );
                                           user.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime()
                                                                                        : null );
                                           user.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime()
                                                                                        : null );
                                           entityManager.persist( user );
                                           return user;
                                       } )
                                        .collect( Collectors.toMap( User::getId, u -> u ) );
        entityManager.flush();
        return users;
    }

    private Map<UUID, BookType> saveBookTypes( ExportPayload payload ) {
        if ( payload.getBookTypes() == null ) {
            return Map.of();
        }
        Map<UUID, BookType> saved = payload.getBookTypes().stream().map( dto -> {
            BookType type = new BookType();
            type.setId( dto.getId() );
            type.setName( dto.getName() );
            type.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime() : null );
            type.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : null );
            entityManager.persist( type );
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
            Source source = new Source();
            source.setId( dto.getId() );
            source.setName( dto.getName() );
            source.setUrl( dto.getUrl() );
            source.setDescription( dto.getDescription() );
            source.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime() : null );
            source.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : null );
            entityManager.persist( source );
            return source;
        } ).collect( Collectors.toMap( Source::getId, s -> s ) );
        entityManager.flush();
        return saved;
    }

    private Map<UUID, SystemNode> saveSystemNodes( ExportPayload payload ) {
        if ( payload.getSystemNodes() == null ) {
            return Map.of();
        }
        Map<UUID, SystemNode> saved = payload.getSystemNodes().stream().map( dto -> {
            SystemNode node = new SystemNode();
            node.setId( dto.getId() );
            node.setNodeKey( dto.getNodeKey() );
            node.setHostname( dto.getHostname() );
            node.setIp( dto.getIp() );
            node.setPort( dto.getPort() );
            node.setCpuLoad( dto.getCpuLoad() );
            node.setSystemMemoryTotal( dto.getSystemMemoryTotal() );
            node.setSystemMemoryFree( dto.getSystemMemoryFree() );
            node.setHeapUsed( dto.getHeapUsed() );
            node.setHeapCommitted( dto.getHeapCommitted() );
            node.setHeapMax( dto.getHeapMax() );
            node.setDiskTotal( dto.getDiskTotal() );
            node.setDiskFree( dto.getDiskFree() );
            node.setUptimeSeconds( dto.getUptimeSeconds() );
            node.setLastReportedAt( dto.getLastReportedAt() );
            node.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime() : null );
            node.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : null );
            entityManager.persist( node );
            return node;
        } ).collect( Collectors.toMap( SystemNode::getId, n -> n ) );
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
        entityManager.persist( settings );
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
            LibraryItem item = new LibraryItem();
            item.setId( dto.getId() );
            item.setKind( dto.getKind() );
            item.setTitle( dto.getTitle() );
            item.setAltTitle( dto.getAltTitle() );
            item.setType( dto.getTypeId() != null ? types.get( dto.getTypeId() ) : null );
            item.setSource( dto.getSourceId() != null ? sources.get( dto.getSourceId() ) : null );
            item.setCreatedBy( dto.getCreatedById() != null ? users.get( dto.getCreatedById() ) : null );
            item.setComment( dto.getComment() );
            item.setRating( dto.getRating() );
            item.setFavorite( dto.isFavorite() );
            item.setStatus( dto.getStatus() );
            item.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime() : null );
            item.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime() : null );
            entityManager.persist( item );
        } );
        entityManager.flush();
        return payload.getLibraryItems().size();
    }

    private long saveSessions( ExportPayload payload, Map<UUID, User> users ) {
        if ( payload.getSessions() == null ) {
            return 0;
        }
        List<Session> sessions = payload.getSessions()
                                        .stream()
                                        .map( dto -> {
                                            User user = dto.getUserId() != null ? users.get( dto.getUserId() ) : null;
                                            if ( user == null ) {
                                                return null;
                                            }
                                            Session session = new Session();
                                            session.setId( dto.getId() );
                                            session.setUser( user );
                                            session.setExpiresAt( dto.getExpiresAt() );
                                            session.setMaxExpiresAt( dto.getMaxExpiresAt() );
                                            session.setCreatedAt( dto.getCreatedAt() != null ? dto.getCreatedAt().toLocalDateTime()
                                                                                             : null );
                                            session.setUpdatedAt( dto.getUpdatedAt() != null ? dto.getUpdatedAt().toLocalDateTime()
                                                                                             : null );
                                            entityManager.persist( session );
                                            return session;
                                        } )
                                        .filter( java.util.Objects::nonNull )
                                        .toList();
        entityManager.flush();
        return sessions.size();
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
                                                                   .comment( item.getComment() )
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

    private List<SessionExport> mapSessions() {
        return StreamSupport.stream( sessionRepository.findAll().spliterator(), false )
                            .map( session -> SessionExport.builder()
                                                           .id( session.getId() )
                                                           .userId( session.getUser().getId() )
                                                           .expiresAt( session.getExpiresAt() )
                                                           .maxExpiresAt( session.getMaxExpiresAt() )
                                                           .createdAt( toOffsetDateTime( session.getCreatedAt() ) )
                                                           .updatedAt( toOffsetDateTime( session.getUpdatedAt() ) )
                                                           .build() )
                            .collect( Collectors.toList() );
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

    private List<SystemNodeExport> mapSystemNodes() {
        return StreamSupport.stream( systemNodeRepository.findAll().spliterator(), false )
                            .map( node -> SystemNodeExport.builder()
                                                           .id( node.getId() )
                                                           .nodeKey( node.getNodeKey() )
                                                           .hostname( node.getHostname() )
                                                           .ip( node.getIp() )
                                                           .port( node.getPort() )
                                                           .cpuLoad( node.getCpuLoad() )
                                                           .systemMemoryTotal( node.getSystemMemoryTotal() )
                                                           .systemMemoryFree( node.getSystemMemoryFree() )
                                                           .heapUsed( node.getHeapUsed() )
                                                           .heapCommitted( node.getHeapCommitted() )
                                                           .heapMax( node.getHeapMax() )
                                                           .diskTotal( node.getDiskTotal() )
                                                           .diskFree( node.getDiskFree() )
                                                           .uptimeSeconds( node.getUptimeSeconds() )
                                                           .lastReportedAt( toOffsetDateTime( node.getLastReportedAt() ) )
                                                           .createdAt( toOffsetDateTime( node.getCreatedAt() ) )
                                                           .updatedAt( toOffsetDateTime( node.getUpdatedAt() ) )
                                                           .build() )
                            .toList();
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

    @Value
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

    @Value
    public static class ExportFile {

        String fileName;
        String contentType;
        byte[] content;
    }

    @Value
    @Builder
    public static class ExportFileInfo {

        String fileName;
        long sizeBytes;
        OffsetDateTime lastModifiedAt;
    }

    @Value
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
        private List<SessionExport> sessions;
        private SessionSettingsExport sessionSettings;
        private List<SystemNodeExport> systemNodes;
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
    private static class SessionExport {

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
    private static class SessionSettingsExport {

        private Integer sessionTtlMinutes;
        private Integer maxSessionLifetimeMinutes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class SystemNodeExport {

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
}
