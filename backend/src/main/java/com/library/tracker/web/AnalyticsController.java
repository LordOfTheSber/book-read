package com.library.tracker.web;

import com.library.tracker.service.analytics.AnalyticsService;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import com.library.tracker.web.dto.ReadingAnalyticsResponse;
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

    private final AnalyticsService analyticsService;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @GetMapping( "/books" )
    public ResponseEntity<BookAnalyticsResponse> getBookAnalytics( @RequestParam Optional<UUID> userId ) {
        return ResponseEntity.ok( analyticsService.bookAnalytics( userId ) );
    }

    /**
     * Отдельная точка, а не расширение {@code /books}: сводку выше запрашивает ещё и список книг
     * с профилем, и тепловая карта с прогнозами оказалась бы в цене каждого открытия библиотеки.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @GetMapping( "/reading" )
    public ResponseEntity<ReadingAnalyticsResponse> getReadingAnalytics( @RequestParam Optional<UUID> userId ) {
        return ResponseEntity.ok( analyticsService.readingAnalytics( userId ) );
    }
}
