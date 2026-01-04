package com.library.tracker.web;

import com.library.tracker.service.LibraryItemService;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping( "/api/v1/analytics" )
@RequiredArgsConstructor
public class AnalyticsController {

    private final LibraryItemService libraryItemService;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @GetMapping( "/books" )
    public ResponseEntity<BookAnalyticsResponse> getBookAnalytics( @RequestParam Optional<UUID> userId ) {
        return ResponseEntity.ok( libraryItemService.getAnalytics( userId ) );
    }
}
