package com.library.tracker.web;

import com.library.tracker.service.ShelfService;
import com.library.tracker.web.dto.ShelfItemResponse;
import com.library.tracker.web.dto.ShelfItemsRequest;
import com.library.tracker.web.dto.ShelfRequest;
import com.library.tracker.web.dto.ShelfResponse;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/shelves" )
@RequiredArgsConstructor
public class ShelfController {

    private final ShelfService shelfService;

    @GetMapping
    public List<ShelfResponse> list() {
        return shelfService.findAll();
    }

    /** Чужая полка отдаётся, только если помечена публичной, — проверка живёт в сервисе. */
    @GetMapping( "/{id}" )
    public ResponseEntity<ShelfResponse> getById( @PathVariable UUID id ) {
        return shelfService.findById( id )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @GetMapping( "/{id}/items" )
    public ResponseEntity<List<ShelfItemResponse>> items( @PathVariable UUID id ) {
        return shelfService.findItems( id )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping
    public ShelfResponse create( @Valid @RequestBody ShelfRequest request ) {
        return shelfService.create( request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<ShelfResponse> update( @PathVariable UUID id, @Valid @RequestBody ShelfRequest request ) {
        return shelfService.update( id, request )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/{id}/items" )
    public ResponseEntity<ShelfResponse> addItems( @PathVariable UUID id,
                                                   @Valid @RequestBody ShelfItemsRequest request ) {
        return shelfService.addItems( id, request )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}/items" )
    public ResponseEntity<ShelfResponse> removeItems( @PathVariable UUID id,
                                                      @Valid @RequestBody ShelfItemsRequest request ) {
        return shelfService.removeItems( id, request )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        shelfService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
