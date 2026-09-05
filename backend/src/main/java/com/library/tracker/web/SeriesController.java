package com.library.tracker.web;

import com.library.tracker.service.SeriesService;
import com.library.tracker.web.dto.SeriesRequest;
import com.library.tracker.web.dto.SeriesResponse;
import com.library.tracker.web.dto.ShowcaseItemResponse;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/series" )
@RequiredArgsConstructor
public class SeriesController {

    private final SeriesService seriesService;

    @GetMapping
    public List<SeriesResponse> list() {
        return seriesService.findAll();
    }

    /** Обложки для карточек цикла — тем же способом, что у авторов: по показанной странице. */
    @GetMapping( "/showcase" )
    public Map<UUID, List<ShowcaseItemResponse>> showcase( @RequestParam( "ids" ) List<UUID> ids ) {
        return seriesService.showcase( ids );
    }

    @GetMapping( "/{id}" )
    public ResponseEntity<SeriesResponse> getById( @PathVariable UUID id ) {
        return seriesService.findById( id ).map( ResponseEntity::ok ).orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR')" )
    @PostMapping
    public ResponseEntity<SeriesResponse> create( @Valid @RequestBody SeriesRequest request ) {
        return ResponseEntity.ok( seriesService.create( request ) );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<SeriesResponse> update( @PathVariable UUID id, @Valid @RequestBody SeriesRequest request ) {
        return seriesService.update( id, request )
                            .map( ResponseEntity::ok )
                            .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        seriesService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
