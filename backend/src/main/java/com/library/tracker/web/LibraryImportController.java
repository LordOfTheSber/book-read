package com.library.tracker.web;

import com.library.tracker.service.importing.LibraryImportService;
import com.library.tracker.web.dto.LibraryImportCommitRequest;
import com.library.tracker.web.dto.LibraryImportPreviewResponse;
import com.library.tracker.web.dto.LibraryImportResultResponse;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Пользовательский импорт своей библиотеки. С {@code /api/v1/exports} не пересекается намеренно:
 * там администраторский бэкап всей базы, доступный только супер-администратору.
 */
@RestController
@RequestMapping( "/api/v1/imports" )
@RequiredArgsConstructor
public class LibraryImportController {

    private final LibraryImportService libraryImportService;

    /** Разбор без единой записи в базе: сначала пользователь смотрит, что получилось. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE )
    public LibraryImportPreviewResponse preview( @RequestParam( "file" ) MultipartFile file ) {
        return libraryImportService.preview( file );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/commit" )
    public LibraryImportResultResponse commit( @Valid @RequestBody LibraryImportCommitRequest request ) {
        return libraryImportService.commit( request );
    }
}
