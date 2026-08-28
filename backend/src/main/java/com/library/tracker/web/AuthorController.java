package com.library.tracker.web;

import com.library.tracker.service.AuthorService;
import com.library.tracker.web.dto.AuthorMergeRequest;
import com.library.tracker.web.dto.AuthorRequest;
import com.library.tracker.web.dto.AuthorResponse;
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

    /**
     * Объединение дублей: справочник заводит автора сам, когда имя вписывают в карточку, поэтому
     * одно и то же лицо оказывается в нём дважды. Права те же, что у правки: это переименование
     * по сути, а не удаление данных — произведения дубля не пропадают, а переезжают.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR')" )
    @PostMapping( "/{id}/merge" )
    public ResponseEntity<AuthorResponse> merge( @PathVariable UUID id, @Valid @RequestBody AuthorMergeRequest request ) {
        return ResponseEntity.ok( authorService.merge( id, request.getTargetId() ) );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        authorService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
