package com.library.tracker.web;

import com.library.tracker.service.SourceService;
import com.library.tracker.web.dto.SourceRequest;
import com.library.tracker.web.dto.SourceResponse;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/sources" )
@RequiredArgsConstructor
public class SourceController {

    private final SourceService sourceService;

    @GetMapping
    public List<SourceResponse> list() {
        return sourceService.findAll();
    }

    @PostMapping
    public ResponseEntity<SourceResponse> create( @Valid @RequestBody SourceRequest request ) {
        SourceResponse response = sourceService.create( request );
        return ResponseEntity.ok( response );
    }

    @PutMapping( "/{id}" )
    public ResponseEntity<SourceResponse> update( @PathVariable UUID id, @Valid @RequestBody SourceRequest request ) {
        return sourceService.update( id, request )
                            .map( ResponseEntity::ok )
                            .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        sourceService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
