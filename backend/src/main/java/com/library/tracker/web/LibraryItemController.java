package com.library.tracker.web;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.service.BulkItemService;
import com.library.tracker.service.DuplicateDetectionService;
import com.library.tracker.service.LibraryItemService;
import com.library.tracker.web.dto.BulkItemDeletePreviewResponse;
import com.library.tracker.web.dto.BulkItemDeleteRequest;
import com.library.tracker.web.dto.BulkItemDeleteResponse;
import com.library.tracker.web.dto.BulkItemUpdateRequest;
import com.library.tracker.web.dto.BulkItemUpdateResponse;
import com.library.tracker.web.dto.CoverFromUrlRequest;
import com.library.tracker.web.dto.DuplicateCandidateResponse;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;
import com.library.tracker.web.dto.PageResponse;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping( "/api/v1/items" )
@RequiredArgsConstructor
public class LibraryItemController {

    private final LibraryItemService libraryItemService;
    private final DuplicateDetectionService duplicateDetectionService;
    private final BulkItemService bulkItemService;

    @GetMapping
    public PageResponse<LibraryItemResponse> getItems(
            @RequestParam( name = "q" ) Optional<String> query,
            @RequestParam Optional<UUID> typeId,
            @RequestParam Optional<ReadingStatus> status,
            @RequestParam Optional<Boolean> favorite,
            @RequestParam Optional<BigDecimal> minRating,
            @RequestParam Optional<BigDecimal> maxRating,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE_TIME ) Optional<OffsetDateTime> createdFrom,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE_TIME ) Optional<OffsetDateTime> createdTo,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE_TIME ) Optional<OffsetDateTime> updatedFrom,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE_TIME ) Optional<OffsetDateTime> updatedTo,
            @RequestParam Optional<MediaKind> kind,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE ) Optional<LocalDate> finishedFrom,
            @RequestParam @DateTimeFormat( iso = DateTimeFormat.ISO.DATE ) Optional<LocalDate> finishedTo,
            @RequestParam Optional<UUID> authorId,
            @RequestParam Optional<UUID> seriesId,
            @RequestParam Optional<UUID> tagId,
            @RequestParam Optional<UUID> shelfId,
            @RequestParam Optional<Boolean> wishlist,
            @RequestParam Optional<UUID> userId,
            @RequestParam( defaultValue = "0" ) int page,
            @RequestParam( defaultValue = "20" ) int size,
            @RequestParam( defaultValue = "updatedAt,desc" ) String sort
                                                     ) {
        LibraryItemFilter filter = new LibraryItemFilter(
                query.map( String::trim ).filter( s -> !s.isEmpty() ),
                typeId, status, favorite, minRating, maxRating, createdFrom, createdTo, updatedFrom,
                updatedTo, kind, finishedFrom, finishedTo, authorId, seriesId, tagId, shelfId, wishlist,
                userId, page, size, parseSort( sort ) );
        return PageResponse.fromPage( libraryItemService.getItems( filter ) );
    }

    /**
     * Похожие записи в библиотеке. Отдельный запрос, а не проверка при сохранении: подсказать
     * нужно до того, как карточка заполнена, и запретить заводить второе издание нельзя.
     */
    @GetMapping( "/duplicates" )
    public List<DuplicateCandidateResponse> duplicates( @RequestParam( required = false ) String isbn,
                                                        @RequestParam( required = false ) String title ) {
        return duplicateDetectionService.findDuplicates( isbn, title );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/bulk" )
    public BulkItemUpdateResponse bulkUpdate( @Valid @RequestBody BulkItemUpdateRequest request ) {
        return bulkItemService.apply( request );
    }

    /** Что исчезнет вместе с записями — до удаления, а не после. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/bulk/delete-preview" )
    public BulkItemDeletePreviewResponse bulkDeletePreview( @Valid @RequestBody BulkItemDeleteRequest request ) {
        return bulkItemService.previewDelete( request.getItemIds() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/bulk/delete" )
    public BulkItemDeleteResponse bulkDelete( @Valid @RequestBody BulkItemDeleteRequest request ) {
        return bulkItemService.delete( request.getItemIds() );
    }

    @GetMapping( "/{id}" )
    public ResponseEntity<LibraryItemResponse> getById( @PathVariable UUID id ) {
        return libraryItemService.getById( id )
                                 .map( ResponseEntity::ok )
                                 .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping
    public ResponseEntity<LibraryItemResponse> create( @Valid @RequestBody LibraryItemRequest request ) {
        LibraryItemResponse response = libraryItemService.create( request );
        return ResponseEntity.ok( response );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<LibraryItemResponse> update( @PathVariable UUID id,
                                                       @Valid @RequestBody LibraryItemRequest request ) {
        return libraryItemService.update( id, request )
                                 .map( ResponseEntity::ok )
                                 .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( value = "/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE )
    public LibraryItemResponse updateCover( @PathVariable UUID id, @RequestParam( "file" ) MultipartFile file ) {
        return libraryItemService.updateCover( id, file );
    }

    /** Обложка из внешнего каталога: файл забирает сервер, потому что у каталогов нет CORS. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/{id}/cover-from-url" )
    public LibraryItemResponse updateCoverFromUrl( @PathVariable UUID id,
                                                  @Valid @RequestBody CoverFromUrlRequest request ) {
        return libraryItemService.updateCoverFromUrl( id, request.getUrl() );
    }

    /**
     * Обложка отдаётся отдельным запросом, а не полем карточки: иначе каждая выборка списка
     * тащила бы за собой мегабайты картинок.
     */
    @GetMapping( "/{id}/cover" )
    public ResponseEntity<byte[]> getCover( @PathVariable UUID id ) {
        return libraryItemService.getCover( id )
                                 .map( stored -> ResponseEntity.ok()
                                                               .contentType( mediaType( stored.contentType() ) )
                                                               .body( stored.content() ) )
                                 .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}/cover" )
    public LibraryItemResponse deleteCover( @PathVariable UUID id ) {
        return libraryItemService.deleteCover( id );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        libraryItemService.delete( id );
        return ResponseEntity.noContent().build();
    }

    private MediaType mediaType( String contentType ) {
        try {
            return contentType != null ? MediaType.parseMediaType( contentType ) : MediaType.APPLICATION_OCTET_STREAM;
        } catch ( InvalidMediaTypeException ex ) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private Sort parseSort( String sort ) {
        String[] parts = sort.split( "," );
        if ( parts.length == 2 && parts[1].equalsIgnoreCase( "desc" ) ) {
            return Sort.by( parts[0] ).descending();
        }
        return Sort.by( parts[0] ).ascending();
    }
}
