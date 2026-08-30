package com.library.tracker.web;

import com.library.tracker.service.TagService;
import com.library.tracker.web.dto.TagDuplicateResponse;
import com.library.tracker.web.dto.TagMergeRequest;
import com.library.tracker.web.dto.TagRequest;
import com.library.tracker.web.dto.TagResponse;
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

/**
 * Теги личные, поэтому — в отличие от типов и авторов — их правит любой владелец, а не редактор:
 * запрещать пользователю заводить себе пометку «на лето» не за что.
 */
@RestController
@RequestMapping( "/api/v1/tags" )
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @GetMapping
    public List<TagResponse> list() {
        return tagService.findAll();
    }

    /** Подозрения на дубли: одни и те же книги под двумя пометками. */
    @GetMapping( "/duplicates" )
    public List<TagDuplicateResponse> duplicates() {
        return tagService.findDuplicates();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping
    public TagResponse create( @Valid @RequestBody TagRequest request ) {
        return tagService.create( request );
    }

    /** Объединение: пометки исходного тега переезжают на указанный, исходный удаляется. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/{id}/merge" )
    public TagResponse merge( @PathVariable UUID id, @Valid @RequestBody TagMergeRequest request ) {
        return tagService.merge( id, request.getTargetId() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/{id}" )
    public ResponseEntity<TagResponse> update( @PathVariable UUID id, @Valid @RequestBody TagRequest request ) {
        return tagService.update( id, request )
                         .map( ResponseEntity::ok )
                         .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> delete( @PathVariable UUID id ) {
        tagService.delete( id );
        return ResponseEntity.noContent().build();
    }
}
