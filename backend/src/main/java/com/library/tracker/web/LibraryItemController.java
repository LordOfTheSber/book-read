package com.library.tracker.web;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.service.LibraryItemService;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;
import com.library.tracker.web.dto.PageResponse;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
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

@RestController
@RequestMapping( "/api/v1/items" )
@RequiredArgsConstructor
public class LibraryItemController {

    private final LibraryItemService libraryItemService;

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
            @RequestParam Optional<UUID> userId,
            @RequestParam( defaultValue = "0" ) int page,
            @RequestParam( defaultValue = "20" ) int size,
            @RequestParam( defaultValue = "updatedAt,desc" ) String sort
                                                     ) {
        LibraryItemFilter filter = new LibraryItemFilter(
                query.map( String::trim ).filter( s -> !s.isEmpty() ),
                typeId, status, favorite, minRating, maxRating, createdFrom, createdTo, updatedFrom,
                updatedTo, kind, userId, page, size, parseSort( sort ) );
        return PageResponse.fromPage( libraryItemService.getItems( filter ) );
    }

    @GetMapping( "/{id}" )
    public ResponseEntity<LibraryItemResponse> getById( @PathVariable UUID id ) {
        return libraryItemService.getById( id )
                                 .map( ResponseEntity::ok )
                                 .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('ADMIN','EDITOR','USER')" )
    @PostMapping
    public ResponseEntity<LibraryItemResponse> create( @Valid @RequestBody LibraryItemRequest request ) {
        LibraryItemResponse response = libraryItemService.create( request );
        return ResponseEntity.ok( response );
    }

    @PreAuthorize( "hasRole('ADMIN')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<LibraryItemResponse> update( @PathVariable UUID id,
                                                       @Valid @RequestBody LibraryItemRequest request ) {
        return libraryItemService.update( id, request )
                                 .map( ResponseEntity::ok )
                                 .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasRole('ADMIN')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        libraryItemService.delete( id );
        return ResponseEntity.noContent().build();
    }

    private Sort parseSort( String sort ) {
        String[] parts = sort.split( "," );
        if ( parts.length == 2 && parts[1].equalsIgnoreCase( "desc" ) ) {
            return Sort.by( parts[0] ).descending();
        }
        return Sort.by( parts[0] ).ascending();
    }
}
