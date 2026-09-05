package com.library.tracker.web;

import com.library.tracker.service.SmartShelfService;
import com.library.tracker.web.dto.SmartShelfRequest;
import com.library.tracker.web.dto.SmartShelfResponse;
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
@RequestMapping( "/api/v1/smart-shelves" )
@RequiredArgsConstructor
public class SmartShelfController {

    private final SmartShelfService smartShelfService;

    @GetMapping
    public List<SmartShelfResponse> list() {
        return smartShelfService.findAll();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping
    public SmartShelfResponse create( @Valid @RequestBody SmartShelfRequest request ) {
        return smartShelfService.create( request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<SmartShelfResponse> update( @PathVariable UUID id,
                                                      @Valid @RequestBody SmartShelfRequest request ) {
        return smartShelfService.update( id, request )
                                .map( ResponseEntity::ok )
                                .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        smartShelfService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
