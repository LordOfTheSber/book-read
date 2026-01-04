package com.library.tracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseDumpService implements ApplicationRunner {

    private static final List<String> TABLES_WITH_UPDATED_AT = List.of(
            "book_types",
            "library_items",
            "sources",
            "users",
            "system_nodes",
            "sessions",
            "session_settings"
    );

    private final DataSourceProperties dataSourceProperties;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ReentrantLock dumpLock = new ReentrantLock();

    @Value( "${db.dump.path:./db-dumps/library_dump.sql}" )
    private String dumpFile;

    @Value( "${db.dump.metadata-path:./db-dumps/library_dump.meta.json}" )
    private String metadataFile;

    @Value( "${db.dump.timeout:PT120S}" )
    private Duration dumpTimeout;

    @Override
    public void run( ApplicationArguments args ) {
        tryRestoreFromDump();
    }

    @Scheduled( cron = "${db.dump.cron:0 0 */4 * * *}" )
    public void scheduledDump() {
        performDump( "scheduled", false );
    }

    @PreDestroy
    public void onShutdown() {
        performDump( "shutdown", true );
    }

    private void tryRestoreFromDump() {
        if ( !acquireLock( false, "startup restore" ) ) {
            return;
        }
        try {
            Path dumpPath = Path.of( dumpFile ).toAbsolutePath().normalize();
            Path metadataPath = Path.of( metadataFile ).toAbsolutePath().normalize();
            if ( !Files.exists( dumpPath ) ) {
                log.info( "No dump file found at {}, skipping restore", dumpPath );
                return;
            }

            DumpMetadata metadata = readMetadata( metadataPath );
            OffsetDateTime dumpDataUpdatedAt = metadata != null ? metadata.dataUpdatedAt() : null;
            if ( dumpDataUpdatedAt == null ) {
                try {
                    dumpDataUpdatedAt = Files.getLastModifiedTime( dumpPath )
                                             .toInstant()
                                             .atOffset( ZoneOffset.UTC );
                } catch ( IOException ex ) {
                    log.warn( "Unable to determine dump freshness from file metadata", ex );
                }
            }
            OffsetDateTime currentDataUpdatedAt = fetchLatestUpdatedAt();
            boolean dumpIsFresher = dumpDataUpdatedAt != null && ( currentDataUpdatedAt == null || dumpDataUpdatedAt.isAfter( currentDataUpdatedAt ) );
            if ( !dumpIsFresher ) {
                log.info( "Current database is newer than dump (db: {}, dump: {}), skipping restore", currentDataUpdatedAt, dumpDataUpdatedAt );
                return;
            }

            DbConnectionInfo connectionInfo = resolveConnectionInfo();
            log.info( "Restoring database from dump {} (dump data timestamp: {})", dumpPath, dumpDataUpdatedAt );
            if ( executeRestore( connectionInfo, dumpPath ) ) {
                log.info( "Database restore completed successfully" );
            } else {
                log.warn( "Database restore failed, leaving current state intact" );
            }
        } catch ( Exception ex ) {
            log.error( "Failed to restore database from dump", ex );
        } finally {
            dumpLock.unlock();
        }
    }

    private void performDump( String reason, boolean waitForLock ) {
        if ( !acquireLock( waitForLock, reason ) ) {
            return;
        }
        try {
            DbConnectionInfo connectionInfo = resolveConnectionInfo();
            Path dumpPath = Path.of( dumpFile ).toAbsolutePath().normalize();
            Path metadataPath = Path.of( metadataFile ).toAbsolutePath().normalize();
            ensureDirectories( dumpPath );
            ensureDirectories( metadataPath );

            OffsetDateTime dataUpdatedAt = fetchLatestUpdatedAt();
            log.info( "Starting database dump (reason: {}) to {}", reason, dumpPath );
            if ( executeDump( connectionInfo, dumpPath ) ) {
                writeMetadata( metadataPath, new DumpMetadata( OffsetDateTime.now( ZoneOffset.UTC ), dataUpdatedAt ) );
                log.info( "Database dump finished (reason: {})", reason );
            } else {
                log.warn( "Database dump failed (reason: {})", reason );
            }
        } catch ( Exception ex ) {
            log.error( "Failed to create database dump", ex );
        } finally {
            dumpLock.unlock();
        }
    }

    private DumpMetadata readMetadata( Path metadataPath ) {
        if ( !Files.exists( metadataPath ) ) {
            return null;
        }
        try {
            return objectMapper.readValue( metadataPath.toFile(), DumpMetadata.class );
        } catch ( Exception ex ) {
            log.warn( "Failed to read dump metadata at {}", metadataPath, ex );
            return null;
        }
    }

    private void writeMetadata( Path metadataPath, DumpMetadata metadata ) {
        try {
            objectMapper.writerWithDefaultPrettyPrinter()
                        .writeValue( metadataPath.toFile(), metadata );
        } catch ( Exception ex ) {
            log.warn( "Failed to write dump metadata to {}", metadataPath, ex );
        }
    }

    private OffsetDateTime fetchLatestUpdatedAt() {
        OffsetDateTime latest = null;
        for ( String table : TABLES_WITH_UPDATED_AT ) {
            try {
                OffsetDateTime tableUpdatedAt = jdbcTemplate.query(
                        "SELECT MAX(updated_at) FROM " + table,
                        rs -> rs.next() ? rs.getObject( 1, OffsetDateTime.class ) : null
                );
                if ( tableUpdatedAt != null && ( latest == null || tableUpdatedAt.isAfter( latest ) ) ) {
                    latest = tableUpdatedAt;
                }
            } catch ( Exception ex ) {
                log.warn( "Failed to fetch updated_at from table {}", table, ex );
            }
        }
        return latest;
    }

    private boolean executeDump( DbConnectionInfo connectionInfo, Path dumpPath ) {
        List<String> command = List.of(
                "pg_dump",
                "--no-password",
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-acl",
                "-h", connectionInfo.host(),
                "-p", Integer.toString( connectionInfo.port() ),
                "-U", connectionInfo.username(),
                "-d", connectionInfo.database(),
                "-f", dumpPath.toString()
        );
        return runCommand( command, connectionInfo.password(), "pg_dump" );
    }

    private boolean executeRestore( DbConnectionInfo connectionInfo, Path dumpPath ) {
        List<String> command = List.of(
                "psql",
                "--no-password",
                "-h", connectionInfo.host(),
                "-p", Integer.toString( connectionInfo.port() ),
                "-U", connectionInfo.username(),
                "-d", connectionInfo.database(),
                "-f", dumpPath.toString()
        );
        return runCommand( command, connectionInfo.password(), "psql" );
    }

    private boolean runCommand( List<String> command, String password, String label ) {
        ProcessBuilder builder = new ProcessBuilder( command );
        builder.redirectErrorStream( true );
        if ( StringUtils.hasText( password ) ) {
            builder.environment().put( "PGPASSWORD", password );
        }
        try {
            Process process = builder.start();
            boolean finished = process.waitFor( dumpTimeout.toMillis(), TimeUnit.MILLISECONDS );
            String output = new String( process.getInputStream().readAllBytes(), StandardCharsets.UTF_8 );
            if ( !finished ) {
                process.destroyForcibly();
                log.warn( "{} timed out after {}. Output: {}", label, dumpTimeout, output );
                return false;
            }
            if ( process.exitValue() != 0 ) {
                log.error( "{} exited with code {}. Output: {}", label, process.exitValue(), output );
                return false;
            }
            if ( StringUtils.hasText( output ) ) {
                log.debug( "{} output: {}", label, output );
            }
            return true;
        } catch ( InterruptedException ex ) {
            Thread.currentThread().interrupt();
            log.error( "{} interrupted", label, ex );
            return false;
        } catch ( IOException ex ) {
            log.error( "Failed to run {}. Ensure the utility is installed and on PATH", label, ex );
            return false;
        }
    }

    private boolean acquireLock( boolean wait, String reason ) {
        try {
            boolean acquired = wait
                    ? dumpLock.tryLock( 30, TimeUnit.SECONDS )
                    : dumpLock.tryLock();
            if ( !acquired ) {
                log.warn( "Dump operation already running, skipping {}", reason );
            }
            return acquired;
        } catch ( InterruptedException ex ) {
            Thread.currentThread().interrupt();
            log.warn( "Interrupted while waiting for dump lock ({})", reason, ex );
            return false;
        }
    }

    private void ensureDirectories( Path path ) throws IOException {
        Path parent = path.getParent();
        if ( parent != null ) {
            Files.createDirectories( parent );
        }
    }

    private DbConnectionInfo resolveConnectionInfo() {
        String jdbcUrl = dataSourceProperties.getUrl();
        if ( !StringUtils.hasText( jdbcUrl ) ) {
            throw new IllegalStateException( "Datasource URL is not configured" );
        }
        URI uri = URI.create( jdbcUrl.startsWith( "jdbc:" ) ? jdbcUrl.substring( 5 ) : jdbcUrl );
        String host = StringUtils.hasText( uri.getHost() ) ? uri.getHost() : "localhost";
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String database = null;
        if ( StringUtils.hasText( uri.getPath() ) ) {
            database = uri.getPath().replaceFirst( "^/", "" );
        }
        if ( !StringUtils.hasText( database ) ) {
            database = dataSourceProperties.getName();
        }
        if ( !StringUtils.hasText( database ) ) {
            throw new IllegalStateException( "Unable to resolve database name from URL: " + jdbcUrl );
        }

        return new DbConnectionInfo(
                host,
                port,
                database,
                dataSourceProperties.getUsername(),
                dataSourceProperties.getPassword()
        );
    }

    private record DumpMetadata( OffsetDateTime dumpCreatedAt, OffsetDateTime dataUpdatedAt ) {
    }

    private record DbConnectionInfo( String host, int port, String database, String username, String password ) {
    }
}
