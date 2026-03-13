package com.library.tracker.web;

import com.library.tracker.service.NovelParserService;
import com.library.tracker.web.dto.NovelChapterResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping( "/api/v1/novel-reader" )
@RequiredArgsConstructor
@Slf4j
public class NovelReaderController {

    private final NovelParserService novelParserService;

    @GetMapping( "/parse" )
    public ResponseEntity<?> parseChapter( @RequestParam String url,
                                         @RequestParam( defaultValue = "3" ) int maxAttempts ) {
        try {
            NovelChapterResponse response = novelParserService.parseChapter( url, maxAttempts );
            return ResponseEntity.ok( response );
        } catch ( IllegalArgumentException e ) {
            log.warn( "Invalid novel URL: {}", e.getMessage() );
            return ResponseEntity.badRequest()
                                 .body( Map.of( "message", e.getMessage() ) );
        } catch ( Exception e ) {
            log.error( "Failed to parse novel chapter from URL: {}", url, e );
            return ResponseEntity.internalServerError()
                                 .body( Map.of( "message",
                                                "Не удалось загрузить страницу: " + e.getMessage() ) );
        }
    }
}
