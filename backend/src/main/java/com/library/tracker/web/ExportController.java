package com.library.tracker.web;

import com.library.tracker.service.DataExportService;
import com.library.tracker.web.dto.ExportResponse;
import com.library.tracker.web.dto.ExportFileResponse;
import com.library.tracker.web.dto.ImportResponse;

import java.util.Optional;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/exports" )
@RequiredArgsConstructor
public class ExportController {

    private final DataExportService dataExportService;

    @PostMapping
    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    public ExportResponse exportNow() {
        DataExportService.ExportResult result = dataExportService.exportData();
        return ExportResponse.builder()
                             .fileName( result.getFileName() )
                             .path( result.getPath() )
                             .downloadUrl( "/api/v1/exports/" + result.getFileName() )
                             .exportedAt( result.getExportedAt() )
                             .usersCount( result.getUsersCount() )
                             .itemsCount( result.getItemsCount() )
                             .bookTypesCount( result.getBookTypesCount() )
                             .sourcesCount( result.getSourcesCount() )
                             .sessionsCount( result.getSessionsCount() )
                             .systemNodesCount( result.getSystemNodesCount() )
                             .build();
    }

    @GetMapping
    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    public ResponseEntity<?> list() {
        var files = dataExportService.listExports()
                                     .stream()
                                     .map( file -> ExportFileResponse.builder()
                                                                     .fileName( file.getFileName() )
                                                                     .sizeBytes( file.getSizeBytes() )
                                                                     .lastModifiedAt( file.getLastModifiedAt() )
                                                                     .downloadUrl( "/api/v1/exports/" + file.getFileName() )
                                                                     .build() )
                                     .collect( Collectors.toList() );
        return ResponseEntity.ok( files );
    }

    @GetMapping( "/{fileName}" )
    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    public ResponseEntity<Resource> download( @PathVariable String fileName ) {
        Optional<DataExportService.ExportFile> exportFile = dataExportService.resolveFile( fileName );
        return exportFile.<ResponseEntity<Resource>>map( file -> ResponseEntity.ok()
                                                                                .header( HttpHeaders.CONTENT_DISPOSITION,
                                                                                         "attachment; filename=\""
                                                                                         + file.getFileName() + "\"" )
                                                                                .contentType( MediaType.parseMediaType(
                                                                                        file.getContentType() ) )
                                                                                .contentLength( file.getContent().length )
                                                                                .body( new ByteArrayResource(
                                                                                        file.getContent() ) ) )
                         .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PostMapping( "/{fileName}/restore" )
    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    public ResponseEntity<ImportResponse> restore( @PathVariable String fileName ) {
        DataExportService.ImportResult result = dataExportService.importData( fileName );
        ImportResponse response = ImportResponse.builder()
                                                .fileName( result.getFileName() )
                                                .restoredUsers( result.getRestoredUsers() )
                                                .restoredItems( result.getRestoredItems() )
                                                .restoredBookTypes( result.getRestoredBookTypes() )
                                                .restoredSources( result.getRestoredSources() )
                                                .restoredSystemNodes( result.getRestoredSystemNodes() )
                                                .restoredSessions( result.getRestoredSessions() )
                                                .build();
        return ResponseEntity.ok( response );
    }

    @DeleteMapping( "/{fileName}" )
    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    public ResponseEntity<Void> delete( @PathVariable String fileName ) {
        dataExportService.deleteExport( fileName );
        return ResponseEntity.noContent().build();
    }
}
