package com.library.tracker.service.importing;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.User;
import com.library.tracker.service.BulkItemService;
import com.library.tracker.service.DuplicateDetectionService;
import com.library.tracker.service.LibraryItemService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.BulkItemUpdateRequest;
import com.library.tracker.web.dto.DuplicateCandidateResponse;
import com.library.tracker.web.dto.LibraryImportColumnResponse;
import com.library.tracker.web.dto.LibraryImportCommitRequest;
import com.library.tracker.web.dto.LibraryImportPreviewResponse;
import com.library.tracker.web.dto.LibraryImportResultResponse;
import com.library.tracker.web.dto.LibraryImportRow;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Пользовательский импорт библиотеки из Goodreads, StoryGraph и LiveLib. Существующий
 * {@code DataExportService} к нему отношения не имеет: там администраторский бэкап всей базы,
 * здесь — чужой формат, который почти всегда требует правки перед заведением.
 * <p>
 * Отсюда два шага. Разбор ничего не пишет и возвращает превью с найденными дублями; заводятся
 * только те строки, которые вернул клиент, — их можно поправить, не переразбирая файл.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LibraryImportService {

    /** Файл читается целиком в память, поэтому граница нужна и по размеру, и по строкам. */
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

    private final CsvImportParser parser;
    private final DuplicateDetectionService duplicateDetectionService;
    private final LibraryItemService libraryItemService;
    private final BulkItemService bulkItemService;
    private final UserService userService;

    @Transactional( readOnly = true )
    public LibraryImportPreviewResponse preview( MultipartFile file ) {
        validate( file );
        User currentUser = userService.getCurrentUser();

        CsvImportParser.Parsed parsed;
        try {
            parsed = parser.parse( file.getInputStream(), file.getOriginalFilename() );
        } catch ( IOException ex ) {
            throw new IllegalArgumentException( "Не удалось прочитать файл: " + ex.getMessage() );
        }

        int duplicateRows = 0;
        for ( LibraryImportRow row : parsed.rows() ) {
            if ( !StringUtils.hasText( row.getTitle() ) ) {
                continue;
            }
            List<DuplicateCandidateResponse> duplicates =
                    duplicateDetectionService.findDuplicates( row.getIsbn(), row.getTitle(), currentUser );
            row.setDuplicates( duplicates );
            if ( !duplicates.isEmpty() ) {
                duplicateRows++;
            }
        }

        long valid = parsed.rows().stream().filter( row -> row.getErrors().isEmpty() ).count();
        return LibraryImportPreviewResponse.builder()
                                           .fileName( parsed.fileName() )
                                           .detectedSource( parsed.source() )
                                           .totalRows( parsed.rows().size() )
                                           .validRows( (int) valid )
                                           .duplicateRows( duplicateRows )
                                           .rows( parsed.rows() )
                                           .columns( columns( parsed ) )
                                           .build();
    }

    private List<LibraryImportColumnResponse> columns( CsvImportParser.Parsed parsed ) {
        return parsed.columns().stream()
                     .map( column -> LibraryImportColumnResponse.builder()
                                                                .name( column.name() )
                                                                .target( column.target() )
                                                                .recognized( column.recognized() )
                                                                .sample( column.sample() )
                                                                .build() )
                     .toList();
    }

    /**
     * Общей транзакции здесь намеренно нет: строки заводятся каждая в своей. Иначе первая же
     * неудачная пометила бы общую транзакцию как rollback-only, и пойманное исключение всё равно
     * обрушило бы весь импорт на коммите — вместе с сотней уже разобранных строк.
     */
    public LibraryImportResultResponse commit( LibraryImportCommitRequest request ) {
        User currentUser = userService.getCurrentUser();
        boolean skipDuplicates =
                request.getDuplicateStrategy() != LibraryImportCommitRequest.DuplicateStrategy.IMPORT_ANYWAY;

        List<String> errors = new ArrayList<>();
        List<UUID> createdIds = new ArrayList<>();
        int skipped = 0;

        for ( LibraryImportRow row : request.getRows() ) {
            if ( !StringUtils.hasText( row.getTitle() ) ) {
                errors.add( "Строка " + row.getLine() + ": нет названия" );
                continue;
            }
            // Дубли перепроверяются здесь, а не берутся из присланного превью: клиент мог
            // прислать что угодно, да и библиотека за время разбора могла пополниться.
            if ( skipDuplicates
                 && !duplicateDetectionService.findDuplicates( row.getIsbn(), row.getTitle(), currentUser )
                                              .isEmpty() ) {
                skipped++;
                continue;
            }
            try {
                LibraryItemResponse created = libraryItemService.create( toRequest( row ) );
                createdIds.add( created.getId() );
            } catch ( RuntimeException ex ) {
                log.warn( "Строка {} импорта не завелась: {}", row.getLine(), ex.getMessage() );
                errors.add( "Строка " + row.getLine() + ": " + ex.getMessage() );
            }
        }

        applyCommonTagsAndShelf( request, createdIds );

        return LibraryImportResultResponse.builder()
                                          .imported( createdIds.size() )
                                          .skippedAsDuplicate( skipped )
                                          .failed( errors.size() )
                                          .errors( errors )
                                          .build();
    }

    /** Общий тег и полка на всю пачку: без них свежий импорт не отличить от заведённого руками. */
    private void applyCommonTagsAndShelf( LibraryImportCommitRequest request, List<UUID> createdIds ) {
        boolean hasTags = request.getTagNames() != null && !request.getTagNames().isEmpty();
        if ( createdIds.isEmpty() || ( !hasTags && request.getShelfId() == null ) ) {
            return;
        }
        BulkItemUpdateRequest bulk = new BulkItemUpdateRequest();
        bulk.setItemIds( createdIds );
        bulk.setAddTagNames( request.getTagNames() );
        bulk.setAddToShelfId( request.getShelfId() );
        bulkItemService.apply( bulk );
    }

    private LibraryItemRequest toRequest( LibraryImportRow row ) {
        LibraryItemRequest request = new LibraryItemRequest();
        request.setKind( row.getKind() != null ? row.getKind() : MediaKind.BOOK );
        request.setTitle( row.getTitle().trim() );
        request.setAuthorNames( row.getAuthorNames() );
        request.setTagNames( row.getTagNames() );
        request.setSeriesName( row.getSeriesName() );
        request.setIsbn( row.getIsbn() );
        request.setPublishedYear( row.getPublishedYear() );
        request.setPageCount( row.getPageCount() );
        // Число страниц издания заодно задаёт шкалу прогресса: у импортированной книги
        // другого источника для неё нет.
        request.setProgressTotal( row.getPageCount() );
        request.setRating( row.getRating() );
        request.setStatus( row.getStatus() != null ? row.getStatus() : ReadingStatus.PLANNED );
        request.setStartedAt( row.getStartedAt() );
        request.setFinishedAt( row.getFinishedAt() );
        request.setReview( row.getReview() );
        request.setNote( row.getNote() );
        return request;
    }

    private void validate( MultipartFile file ) {
        if ( file == null || file.isEmpty() ) {
            throw new IllegalArgumentException( "Файл импорта пуст" );
        }
        if ( file.getSize() > MAX_FILE_BYTES ) {
            throw new IllegalArgumentException( "Файл должен быть меньше 10 МБ" );
        }
        String name = file.getOriginalFilename();
        if ( name != null && !name.toLowerCase().endsWith( ".csv" ) && !name.toLowerCase().endsWith( ".tsv" ) ) {
            throw new IllegalArgumentException( "Поддерживаются файлы CSV" );
        }
    }
}
