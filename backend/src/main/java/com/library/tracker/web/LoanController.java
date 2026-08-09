package com.library.tracker.web;

import com.library.tracker.service.social.LoanService;
import com.library.tracker.web.dto.LoanRequest;
import com.library.tracker.web.dto.LoanResponse;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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
public class LoanController {

    private final LoanService loanService;

    @GetMapping( "/items/{itemId}/loans" )
    public List<LoanResponse> byItem( @PathVariable UUID itemId ) {
        return loanService.findByItem( itemId );
    }

    /** Что сейчас на руках: просроченные первыми. */
    @GetMapping( "/loans" )
    public List<LoanResponse> open() {
        return loanService.findOpen();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/items/{itemId}/loans" )
    public LoanResponse create( @PathVariable UUID itemId, @Valid @RequestBody LoanRequest request ) {
        return loanService.create( itemId, request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/loans/{loanId}" )
    public ResponseEntity<LoanResponse> update( @PathVariable UUID loanId, @Valid @RequestBody LoanRequest request ) {
        return loanService.update( loanId, request )
                          .map( ResponseEntity::ok )
                          .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/loans/{loanId}/return" )
    public ResponseEntity<LoanResponse> markReturned(
            @PathVariable UUID loanId,
            @RequestParam( required = false ) @DateTimeFormat( iso = DateTimeFormat.ISO.DATE ) LocalDate returnedOn ) {
        return loanService.markReturned( loanId, returnedOn )
                          .map( ResponseEntity::ok )
                          .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/loans/{loanId}" )
    public ResponseEntity<Void> delete( @PathVariable UUID loanId ) {
        loanService.delete( loanId );
        return ResponseEntity.noContent().build();
    }
}
