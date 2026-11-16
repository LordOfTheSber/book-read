package com.library.tracker.web;

import com.library.tracker.service.metadata.ExternalMetadataService;
import com.library.tracker.web.dto.ExternalBookResponse;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Поиск по внешним каталогам. Запрос идёт через сервер, а не из браузера: так не приходится
 * зависеть от CORS-политики чужого сервиса и можно держать таймауты и список хостов в одном месте.
 */
@RestController
@RequestMapping( "/api/v1/metadata" )
@RequiredArgsConstructor
public class MetadataController {

    private final ExternalMetadataService externalMetadataService;

    @GetMapping( "/search" )
    public List<ExternalBookResponse> search( @RequestParam( value = "q", required = false ) String query,
                                              @RequestParam( required = false ) String isbn,
                                              @RequestParam( required = false ) String provider,
                                              @RequestParam( required = false ) Integer limit ) {
        return externalMetadataService.search( query, isbn, provider, limit );
    }
}
