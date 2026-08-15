package com.library.tracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.service.export.ExportPayload;
import com.library.tracker.service.export.SnapshotCollector;
import com.library.tracker.service.export.SnapshotRestorer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Административный бэкап: снимок всей базы в файл и восстановление системы из него. Не путать с
 * {@code UserDataExportService} — та выгружает данные одного пользователя и доступна каждому,
 * а эта закрыта на супер-администратора и содержит в том числе хеши паролей.
 * <p>
 * Сервис отвечает за файлы: где они лежат, как называются, как попадают на сервер и как читаются
 * обратно. Что именно попадает в файл, знает {@link SnapshotCollector}, а как оно раскладывается
 * по таблицам — {@link SnapshotRestorer}.
 * <p>
 * Копию можно не только снять, но и принести с собой ({@link #uploadExport}): восстановление после
 * потери сервера начинается с файла, который лежит где угодно, только не на этом сервере. Файл
 * при загрузке разбирается — в каталог не попадает то, что потом не прочитается.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class DataExportService {

    private static final DateTimeFormatter FILE_NAME_FORMATTER = DateTimeFormatter.ofPattern( "yyyy-MM-dd_HH-mm-ss" );

    private static final String EXTENSION = ".json";

    /** Что остаётся от принесённого имени файла: остальное заменяется подчёркиванием. */
    private static final String SAFE_NAME_PATTERN = "[^A-Za-z0-9._-]";

    private final ObjectMapper objectMapper;
    private final SnapshotCollector snapshotCollector;
    private final SnapshotRestorer snapshotRestorer;

    @org.springframework.beans.factory.annotation.Value( "${export.directory:exports}" )
    private String exportDirectory;

    /** Потолок на принесённый файл. Разбор идёт в памяти, поэтому он не может быть безграничным. */
    @org.springframework.beans.factory.annotation.Value( "${export.max-upload-bytes:67108864}" )
    private long maxUploadBytes;

    @Transactional( readOnly = true )
    public ExportResult exportData() {
        OffsetDateTime exportedAt = OffsetDateTime.now( ZoneOffset.UTC );
        ExportPayload payload = snapshotCollector.collect( exportedAt );

        Path directory = resolveExportDirectory();
        String fileName = "export-" + FILE_NAME_FORMATTER.format( exportedAt ) + EXTENSION;
        Path filePath = directory.resolve( fileName );
        try {
            Files.createDirectories( directory );
            objectMapper.writerWithDefaultPrettyPrinter().writeValue( filePath.toFile(), payload );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось сохранить данные в файл", ex );
        }

        Map<String, Long> counts = counts( payload );
        return ExportResult.builder()
                           .fileName( fileName )
                           .path( filePath.toAbsolutePath().toString() )
                           .schemaVersion( ExportPayload.CURRENT_SCHEMA_VERSION )
                           .exportedAt( exportedAt )
                           .usersCount( count( counts, "users" ) )
                           .itemsCount( count( counts, "libraryItems" ) )
                           .bookTypesCount( count( counts, "bookTypes" ) )
                           .sourcesCount( count( counts, "sources" ) )
                           .sessionsCount( count( counts, "sessions" ) )
                           .systemNodesCount( count( counts, "systemNodes" ) )
                           .counts( counts )
                           .build();
    }

    @Transactional( readOnly = true )
    public List<ExportFileInfo> listExports() {
        Path directory = resolveExportDirectory();
        if ( !Files.isDirectory( directory ) ) {
            return List.of();
        }
        try ( var stream = Files.list( directory ) ) {
            return stream.filter( this::isExportFile )
                         .map( path -> ExportFileInfo.builder()
                                                     .fileName( path.getFileName().toString() )
                                                     .sizeBytes( path.toFile().length() )
                                                     .lastModifiedAt( OffsetDateTime.ofInstant(
                                                             Instant.ofEpochMilli( path.toFile().lastModified() ),
                                                             ZoneOffset.UTC ) )
                                                     .build() )
                         .sorted( Comparator.comparing( ExportFileInfo::getLastModifiedAt ).reversed() )
                         .toList();
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось получить список экспортов", ex );
        }
    }

    /**
     * Принимает файл копии со стороны. Содержимое разбирается до записи на диск: файл, который
     * не прочитается при восстановлении, в списке копий не нужен — он выглядит там страховкой,
     * которой на самом деле нет.
     */
    public ExportFileInfo uploadExport( MultipartFile file ) {
        if ( file == null || file.isEmpty() ) {
            throw new IllegalArgumentException( "Файл не выбран" );
        }
        if ( file.getSize() > maxUploadBytes ) {
            throw new IllegalArgumentException( "Файл больше допустимых " + maxUploadBytes / ( 1024 * 1024 ) + " МБ" );
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось прочитать загруженный файл", ex );
        }

        ExportPayload payload = parse( content );

        Path directory = resolveExportDirectory();
        Path target = freeName( directory, uploadedFileName( file.getOriginalFilename() ) );
        try {
            Files.createDirectories( directory );
            Files.write( target, content );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось сохранить загруженный файл", ex );
        }

        log.info( "Загружена резервная копия {} (версия формата {}, снята {})",
                  target.getFileName(), schemaVersion( payload ), payload.getExportedAt() );

        return ExportFileInfo.builder()
                             .fileName( target.getFileName().toString() )
                             .sizeBytes( content.length )
                             .lastModifiedAt( OffsetDateTime.now( ZoneOffset.UTC ) )
                             .build();
    }

    public void deleteExport( String fileName ) {
        Path path = resolveExportPath( fileName )
                .orElseThrow( () -> new IllegalArgumentException( "Файл не найден" ) );
        try {
            Files.deleteIfExists( path );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось удалить файл экспорта", ex );
        }
    }

    /**
     * Восстановление системы из копии. Текущее содержимое заменяется целиком — и, поскольку всё
     * идёт одной транзакцией, копия, которая не легла, не оставляет после себя половину базы.
     */
    public ImportResult importData( String fileName ) {
        ExportFile exportFile = resolveFile( fileName )
                .orElseThrow( () -> new IllegalArgumentException( "Файл не найден" ) );
        ExportPayload payload = parse( exportFile.getContent() );
        int schemaVersion = schemaVersion( payload );

        log.info( "Восстановление из {}: версия формата {}, копия снята {}",
                  exportFile.getFileName(), schemaVersion, payload.getExportedAt() );

        Map<String, Long> counts = snapshotRestorer.restore( payload );

        return ImportResult.builder()
                           .fileName( exportFile.getFileName() )
                           .schemaVersion( schemaVersion )
                           .exportedAt( payload.getExportedAt() )
                           .restoredUsers( count( counts, "users" ) )
                           .restoredItems( count( counts, "libraryItems" ) )
                           .restoredBookTypes( count( counts, "bookTypes" ) )
                           .restoredSources( count( counts, "sources" ) )
                           .restoredSystemNodes( count( counts, "systemNodes" ) )
                           .restoredSessions( count( counts, "sessions" ) )
                           .counts( counts )
                           .build();
    }

    @Transactional( readOnly = true )
    public Optional<Path> findLatestExport() {
        Path directory = resolveExportDirectory();
        if ( !Files.isDirectory( directory ) ) {
            return Optional.empty();
        }
        try ( var stream = Files.list( directory ) ) {
            return stream.filter( this::isExportFile )
                         .max( Comparator.comparingLong( path -> path.toFile().lastModified() ) );
        } catch ( IOException ex ) {
            log.warn( "Failed to list export directory", ex );
            return Optional.empty();
        }
    }

    @Transactional( readOnly = true )
    public Optional<ExportFile> resolveFile( String fileName ) {
        Optional<Path> path = resolveExportPath( fileName );
        if ( path.isEmpty() ) {
            return Optional.empty();
        }
        try {
            byte[] content = Files.readAllBytes( path.get() );
            return Optional.of( new ExportFile( path.get().getFileName().toString(),
                                                MediaType.APPLICATION_JSON_VALUE, content ) );
        } catch ( IOException ex ) {
            throw new IllegalStateException( "Не удалось прочитать файл экспорта", ex );
        }
    }

    private ExportPayload parse( byte[] content ) {
        try {
            ExportPayload payload = objectMapper.readValue( content, ExportPayload.class );
            if ( payload == null ) {
                throw new IllegalArgumentException( "Некорректный формат файла экспорта" );
            }
            return payload;
        } catch ( IOException ex ) {
            throw new IllegalArgumentException( "Некорректный формат файла экспорта", ex );
        }
    }

    /** У копий, снятых до появления поля, версии в файле нет — это первая. */
    private int schemaVersion( ExportPayload payload ) {
        return payload.getSchemaVersion() != null
                ? payload.getSchemaVersion()
                : ExportPayload.LEGACY_SCHEMA_VERSION;
    }

    /**
     * Имя приводится к безопасному виду и остаётся узнаваемым: копию с чужого сервера ищут
     * глазами по дате в имени. Каталог из имени вырезается — путь задаёт сервер, а не клиент.
     */
    private String uploadedFileName( String originalName ) {
        String base = StringUtils.hasText( originalName )
                ? Paths.get( originalName ).getFileName().toString()
                : "";
        base = base.replaceAll( SAFE_NAME_PATTERN, "_" );
        if ( base.toLowerCase( Locale.ROOT ).endsWith( EXTENSION ) ) {
            base = base.substring( 0, base.length() - EXTENSION.length() );
        }
        if ( !StringUtils.hasText( base.replace( "_", "" ) ) ) {
            base = "upload-" + FILE_NAME_FORMATTER.format( OffsetDateTime.now( ZoneOffset.UTC ) );
        }
        return base + EXTENSION;
    }

    /** Одноимённая копия не затирается: у принесённого файла может не быть второго экземпляра. */
    private Path freeName( Path directory, String fileName ) {
        Path candidate = directory.resolve( fileName );
        String base = fileName.substring( 0, fileName.length() - EXTENSION.length() );
        for ( int suffix = 2; Files.exists( candidate ); suffix++ ) {
            candidate = directory.resolve( base + "-" + suffix + EXTENSION );
        }
        return candidate;
    }

    /**
     * Путь к файлу копии по имени от клиента. Каталог из имени отбрасывается, расширение
     * проверяется: и то и другое здесь не формальность, а единственная преграда между
     * {@code ../../etc/passwd} и файловой системой сервера.
     */
    private Optional<Path> resolveExportPath( String fileName ) {
        if ( !StringUtils.hasText( fileName ) ) {
            return Optional.empty();
        }
        String sanitized = Paths.get( fileName ).getFileName().toString();
        if ( !sanitized.toLowerCase( Locale.ROOT ).endsWith( EXTENSION ) ) {
            return Optional.empty();
        }
        Path path = resolveExportDirectory().resolve( sanitized );
        return Files.isRegularFile( path ) ? Optional.of( path ) : Optional.empty();
    }

    private boolean isExportFile( Path path ) {
        return Files.isRegularFile( path )
               && path.getFileName().toString().toLowerCase( Locale.ROOT ).endsWith( EXTENSION );
    }

    private Path resolveExportDirectory() {
        String directory = StringUtils.hasText( exportDirectory ) ? exportDirectory.trim() : "exports";
        return Paths.get( directory );
    }

    /** Столько записей ушло в файл — считается по самому файлу, а не повторным запросом к базе. */
    private Map<String, Long> counts( ExportPayload payload ) {
        java.util.LinkedHashMap<String, Long> counts = new java.util.LinkedHashMap<>();
        counts.put( "users", size( payload.getUsers() ) );
        counts.put( "bookTypes", size( payload.getBookTypes() ) );
        counts.put( "sources", size( payload.getSources() ) );
        counts.put( "authors", size( payload.getAuthors() ) );
        counts.put( "series", size( payload.getSeries() ) );
        counts.put( "tags", size( payload.getTags() ) );
        counts.put( "shelves", size( payload.getShelves() ) );
        counts.put( "shelfMembers", size( payload.getShelfMembers() ) );
        counts.put( "smartShelves", size( payload.getSmartShelves() ) );
        counts.put( "libraryItems", size( payload.getLibraryItems() ) );
        counts.put( "readingLogs", size( payload.getReadingLogs() ) );
        counts.put( "readingSessions", size( payload.getReadingSessions() ) );
        counts.put( "quotes", size( payload.getQuotes() ) );
        counts.put( "loans", size( payload.getLoans() ) );
        counts.put( "reviewComments", size( payload.getReviewComments() ) );
        counts.put( "reviewReactions", size( payload.getReviewReactions() ) );
        counts.put( "userFollows", size( payload.getUserFollows() ) );
        counts.put( "activityEvents", size( payload.getActivityEvents() ) );
        counts.put( "readingGoals", size( payload.getReadingGoals() ) );
        counts.put( "userAchievements", size( payload.getUserAchievements() ) );
        counts.put( "systemNodes", size( payload.getSystemNodes() ) );
        counts.put( "sessions", size( payload.getSessions() ) );
        return counts;
    }

    private long size( List<?> rows ) {
        return rows != null ? rows.size() : 0;
    }

    private long count( Map<String, Long> counts, String section ) {
        return counts.getOrDefault( section, 0L );
    }

    @lombok.Value
    @Builder
    public static class ExportResult {

        String fileName;
        String path;
        int schemaVersion;
        OffsetDateTime exportedAt;
        long usersCount;
        long itemsCount;
        long bookTypesCount;
        long sourcesCount;
        long sessionsCount;
        long systemNodesCount;
        /**
         * Разбивка по разделам файла. Именованные счётчики выше оставлены ради совместимости
         * ответа: разделов теперь два десятка, и заводить поле на каждый — значит менять контракт
         * при появлении любой новой сущности.
         */
        Map<String, Long> counts;
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
        /** Версия формата прочитанного файла: по ней видно, насколько старую копию подняли. */
        int schemaVersion;
        OffsetDateTime exportedAt;
        long restoredUsers;
        long restoredItems;
        long restoredBookTypes;
        long restoredSources;
        long restoredSystemNodes;
        long restoredSessions;
        Map<String, Long> counts;
    }
}
