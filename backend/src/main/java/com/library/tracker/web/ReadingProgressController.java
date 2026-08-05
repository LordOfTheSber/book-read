package com.library.tracker.web;

import com.library.tracker.service.ReadingProgressService;
import com.library.tracker.web.dto.ReadingLogResponse;
import com.library.tracker.web.dto.ReadingSessionRequest;
import com.library.tracker.web.dto.ReadingSessionResponse;
import jakarta.validation.Valid;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Заходы и проходы живут под произведением: отдельно от него они не имеют смысла, а вложенный
 * путь заодно делает проверку владельца обязательной.
 */
@RestController
@RequestMapping( "/api/v1/items/{itemId}" )
@RequiredArgsConstructor
public class ReadingProgressController {

    private final ReadingProgressService readingProgressService;
    private final Clock clock;

    @GetMapping( "/sessions" )
    public List<ReadingSessionResponse> listSessions( @PathVariable UUID itemId ) {
        return readingProgressService.listSessions( itemId );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/sessions" )
    public ReadingSessionResponse addSession( @PathVariable UUID itemId,
                                              @Valid @RequestBody ReadingSessionRequest request ) {
        return readingProgressService.addSession( itemId, request, LocalDate.now( clock ) );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/sessions/{sessionId}" )
    public ResponseEntity<Void> deleteSession( @PathVariable UUID itemId, @PathVariable UUID sessionId ) {
        readingProgressService.deleteSession( itemId, sessionId );
        return ResponseEntity.noContent().build();
    }

    /** История перечитываний: по проходу на попытку, с датами и оценкой каждой. */
    @GetMapping( "/logs" )
    public List<ReadingLogResponse> listLogs( @PathVariable UUID itemId ) {
        return readingProgressService.listLogs( itemId );
    }
}
