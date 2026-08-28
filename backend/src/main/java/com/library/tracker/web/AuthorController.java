package com.library.tracker.web;

import com.library.tracker.service.AuthorService;
import com.library.tracker.web.dto.AuthorRequest;
import com.library.tracker.web.dto.AuthorResponse;
import com.library.tracker.web.dto.MergeRequest;
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
@RequestMapping( "/api/v1/authors" )
@RequiredArgsConstructor
public class AuthorController {

    private final AuthorService authorService;

    @GetMapping
    public List<AuthorResponse> list( @RequestParam( value = "q", required = false ) String query ) {
        return authorService.findAll( query );
    }

    /**
     * Обложки для карточек справочника. Идентификаторы перечисляет страница: витрина листается,
     * и грузить обложки всех авторов ради показанных восемнадцати незачем.
     */
    @GetMapping( "/showcase" )
    public Map<UUID, List<ShowcaseItemResponse>> showcase( @RequestParam( "ids" ) List<UUID> ids ) {
        return authorService.showcase( ids );
    }

    @GetMapping( "/{id}" )
    public ResponseEntity<AuthorResponse> getById( @PathVariable UUID id ) {
        return authorService.findById( id ).map( ResponseEntity::ok ).orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR')" )
    @PostMapping
    public ResponseEntity<AuthorResponse> create( @Valid @RequestBody AuthorRequest request ) {
        return ResponseEntity.ok( authorService.create( request ) );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<AuthorResponse> update( @PathVariable UUID id, @Valid @RequestBody AuthorRequest request ) {
        return authorService.update( id, request )
                            .map( ResponseEntity::ok )
                            .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    /** Объединение дублей удаляет автора, поэтому спрашивается наравне с удалением. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @PostMapping( "/{id}/merge" )
    public ResponseEntity<AuthorResponse> merge( @PathVariable UUID id, @Valid @RequestBody MergeRequest request ) {
        return authorService.merge( id, request.getSourceId() )
                            .map( ResponseEntity::ok )
                            .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        authorService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
