package com.library.tracker.web;

import com.library.tracker.service.social.ReviewInteractionService;
import com.library.tracker.web.dto.ReviewCommentRequest;
import com.library.tracker.web.dto.ReviewReactionRequest;
import com.library.tracker.web.dto.ReviewThreadResponse;
import jakarta.validation.Valid;

import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Обсуждение отзыва. Живёт под произведением, а не отдельным разделом: отзыв не самостоятельная
 * сущность, у него нет своего идентификатора — он поле карточки.
 */
@RestController
@RequestMapping( "/api/v1/items/{itemId}/review" )
@RequiredArgsConstructor
public class ReviewInteractionController {

    private final ReviewInteractionService reviewInteractionService;

    @GetMapping
    public ReviewThreadResponse thread( @PathVariable UUID itemId ) {
        return reviewInteractionService.thread( itemId );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/reactions" )
    public ReviewThreadResponse react( @PathVariable UUID itemId,
                                       @Valid @RequestBody ReviewReactionRequest request ) {
        return reviewInteractionService.react( itemId, request.getKind() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/reactions" )
    public ReviewThreadResponse removeReaction( @PathVariable UUID itemId ) {
        return reviewInteractionService.removeReaction( itemId );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/comments" )
    public ReviewThreadResponse comment( @PathVariable UUID itemId,
                                         @Valid @RequestBody ReviewCommentRequest request ) {
        return reviewInteractionService.comment( itemId, request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/comments/{commentId}" )
    public ReviewThreadResponse deleteComment( @PathVariable UUID itemId, @PathVariable UUID commentId ) {
        return reviewInteractionService.deleteComment( itemId, commentId );
    }
}
