package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.User;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.web.dto.QuoteRequest;
import com.library.tracker.web.dto.QuoteResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Выписки из произведений: цитата с номером страницы, личная пометка и поиск по всем выпискам. */
@Service
@RequiredArgsConstructor
@Transactional
public class QuoteService {

    private final QuoteRepository quoteRepository;
    private final LibraryItemAccess itemAccess;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<QuoteResponse> findByItem( UUID itemId ) {
        itemAccess.requireReadable( itemId );
        return quoteRepository.findByItemIdOrderByPositionAscCreatedAtAsc( itemId ).stream()
                              .map( this::toResponse )
                              .toList();
    }

    /**
     * Поиск по всем выпискам библиотеки. Обычный пользователь ищет только по своим: цитата —
     * личная запись, а не общий справочник.
     */
    @Transactional( readOnly = true )
    public List<QuoteResponse> search( String query ) {
        if ( !StringUtils.hasText( query ) ) {
            return List.of();
        }
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();
        return quoteRepository.search( query.trim(), scope ).stream().map( this::toResponse ).toList();
    }

    public QuoteResponse create( UUID itemId, QuoteRequest request ) {
        LibraryItem item = itemAccess.requireWritable( itemId, "Вы можете добавлять выписки только к своим книгам" );
        Quote quote = new Quote();
        quote.setItem( item );
        applyRequest( quote, request );
        return toResponse( quoteRepository.save( quote ) );
    }

    public Optional<QuoteResponse> update( UUID itemId, UUID quoteId, QuoteRequest request ) {
        itemAccess.requireWritable( itemId, "Вы можете править выписки только своих книг" );
        return quoteRepository.findById( quoteId )
                              .filter( quote -> quote.getItem().getId().equals( itemId ) )
                              .map( quote -> {
                                  applyRequest( quote, request );
                                  return toResponse( quoteRepository.save( quote ) );
                              } );
    }

    public void delete( UUID itemId, UUID quoteId ) {
        itemAccess.requireWritable( itemId, "Вы можете удалять выписки только своих книг" );
        quoteRepository.findById( quoteId )
                       .filter( quote -> quote.getItem().getId().equals( itemId ) )
                       .ifPresent( quoteRepository::delete );
    }

    private void applyRequest( Quote quote, QuoteRequest request ) {
        quote.setPosition( request.getPosition() );
        quote.setText( request.getText().trim() );
        quote.setNote( StringUtils.hasText( request.getNote() ) ? request.getNote().trim() : null );
    }

    private QuoteResponse toResponse( Quote quote ) {
        return QuoteResponse.builder()
                            .id( quote.getId() )
                            .itemId( quote.getItem().getId() )
                            .itemTitle( quote.getItem().getTitle() )
                            .position( quote.getPosition() )
                            .text( quote.getText() )
                            .note( quote.getNote() )
                            .createdAt( toOffsetDateTime( quote.getCreatedAt() ) )
                            .updatedAt( toOffsetDateTime( quote.getUpdatedAt() ) )
                            .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
