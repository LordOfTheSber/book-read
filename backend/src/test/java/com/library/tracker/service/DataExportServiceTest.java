package com.library.tracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.service.export.SnapshotCollector;
import com.library.tracker.service.export.SnapshotRestorer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * Файловая половина бэкапа: приём копии со стороны и разрешение имени файла. База здесь не нужна —
 * снятие снимка и его раскладку по таблицам проверяет {@code DataBackupIntegrationTest}.
 */
class DataExportServiceTest {

    private static final String MINIMAL_BACKUP = """
            {"schemaVersion":2,"exportedAt":"2025-01-01T00:00:00Z","users":[],"libraryItems":[]}
            """;

    @TempDir
    private Path exportDirectory;

    private DataExportService service;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();
        service = new DataExportService( objectMapper, mock( SnapshotCollector.class ), mock( SnapshotRestorer.class ) );
        ReflectionTestUtils.setField( service, "exportDirectory", exportDirectory.toString() );
        ReflectionTestUtils.setField( service, "maxUploadBytes", 1024L );
    }

    @Test
    void uploadStoresBackupUnderSafeName() {
        DataExportService.ExportFileInfo info = service.uploadExport( file( "backup 2025.json", MINIMAL_BACKUP ) );

        assertThat( info.getFileName() ).isEqualTo( "backup_2025.json" );
        assertThat( exportDirectory.resolve( "backup_2025.json" ) ).exists();
        assertThat( service.listExports() ).extracting( DataExportService.ExportFileInfo::getFileName )
                                           .containsExactly( "backup_2025.json" );
    }

    /** Имя приходит от клиента, а каталог задаёт сервер: подняться из него нельзя. */
    @Test
    void uploadKeepsFileInsideExportDirectory() {
        DataExportService.ExportFileInfo info = service.uploadExport( file( "../../etc/passwd.json", MINIMAL_BACKUP ) );

        assertThat( info.getFileName() ).isEqualTo( "passwd.json" );
        assertThat( exportDirectory.resolve( "passwd.json" ) ).exists();
    }

    /** У принесённого файла может не быть второго экземпляра, поэтому одноимённый не затирается. */
    @Test
    void uploadDoesNotOverwriteExistingBackup() {
        service.uploadExport( file( "backup.json", MINIMAL_BACKUP ) );

        DataExportService.ExportFileInfo second = service.uploadExport( file( "backup.json", MINIMAL_BACKUP ) );

        assertThat( second.getFileName() ).isEqualTo( "backup-2.json" );
        assertThat( service.listExports() ).hasSize( 2 );
    }

    /** Файл, который не прочитается при восстановлении, в списке копий выглядел бы страховкой. */
    @Test
    void uploadRejectsFileThatIsNotABackup() {
        assertThatThrownBy( () -> service.uploadExport( file( "notes.json", "не JSON вовсе" ) ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Некорректный формат" );

        assertThat( service.listExports() ).isEmpty();
    }

    @Test
    void uploadRejectsEmptyAndOversizedFiles() {
        assertThatThrownBy( () -> service.uploadExport( file( "backup.json", "" ) ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "не выбран" );

        assertThatThrownBy( () -> service.uploadExport( file( "backup.json", "x".repeat( 2048 ) ) ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "больше допустимых" );
    }

    @Test
    void resolveFileRejectsTraversalAndForeignExtensions() throws IOException {
        Files.writeString( exportDirectory.resolve( "backup.json" ), MINIMAL_BACKUP, StandardCharsets.UTF_8 );
        Path secret = exportDirectory.getParent().resolve( "secret.json" );
        Files.writeString( secret, "секрет", StandardCharsets.UTF_8 );

        assertThat( service.resolveFile( "backup.json" ) ).isPresent();
        assertThat( service.resolveFile( "../secret.json" ) ).isEmpty();
        assertThat( service.resolveFile( "application.yml" ) ).isEmpty();
        assertThat( service.resolveFile( null ) ).isEmpty();
    }

    /** Удаление ходит по тому же разрешению имени, что и чтение: мимо каталога копий не попасть. */
    @Test
    void deleteRejectsUnknownFile() {
        assertThatThrownBy( () -> service.deleteExport( "../secret.json" ) )
                .isInstanceOf( IllegalArgumentException.class );
    }

    @Test
    void listExportsShowsNewestFirst() throws IOException {
        write( "old.json", 1_000_000L );
        write( "new.json", 2_000_000L );

        List<String> names = service.listExports()
                                    .stream()
                                    .map( DataExportService.ExportFileInfo::getFileName )
                                    .toList();

        assertThat( names ).containsExactly( "new.json", "old.json" );
    }

    private void write( String name, long modifiedAt ) throws IOException {
        Path path = exportDirectory.resolve( name );
        Files.writeString( path, MINIMAL_BACKUP, StandardCharsets.UTF_8 );
        Files.setLastModifiedTime( path, java.nio.file.attribute.FileTime.fromMillis( modifiedAt ) );
    }

    private MockMultipartFile file( String name, String content ) {
        return new MockMultipartFile( "file", name, "application/json", content.getBytes( StandardCharsets.UTF_8 ) );
    }
}
