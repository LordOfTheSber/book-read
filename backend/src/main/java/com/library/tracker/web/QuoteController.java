package com.library.tracker.web;

import com.library.tracker.service.QuoteService;
import com.library.tracker.web.dto.QuoteRequest;
import com.library.tracker.web.dto.QuoteResponse;
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
@RequestMapping( "/api/v1" )
@RequiredArgsConstructor
public class QuoteController {

    private final QuoteService quoteService;

    @GetMapping( "/items/{itemId}/quotes" )
    public List<QuoteResponse> listByItem( @PathVariable UUID itemId ) {
        return quoteService.findByItem( itemId );
    }

    /** Поиск по выпискам всей библиотеки: искать цитату, не помня книгу, — обычное дело. */
    @GetMapping( "/quotes" )
    public List<QuoteResponse> search( @RequestParam( value = "q", required = false ) String query ) {
        return quoteService.search( query );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/items/{itemId}/quotes" )
    public QuoteResponse create( @PathVariable UUID itemId, @Valid @RequestBody QuoteRequest request ) {
        return quoteService.create( itemId, request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/items/{itemId}/quotes/{quoteId}" )
    public ResponseEntity<QuoteResponse> update( @PathVariable UUID itemId, @PathVariable UUID quoteId,
                                                 @Valid @RequestBody QuoteRequest request ) {
        return quoteService.update( itemId, quoteId, request )
                           .map( ResponseEntity::ok )
                           .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/items/{itemId}/quotes/{quoteId}" )
    public ResponseEntity<Void> delete( @PathVariable UUID itemId, @PathVariable UUID quoteId ) {
        quoteService.delete( itemId, quoteId );
        return ResponseEntity.noContent().build();
    }
}
