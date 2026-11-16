package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.web.dto.QuoteRequest;
import com.library.tracker.web.dto.QuoteResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Выписки из произведений: цитата с номером страницы, личная пометка и поиск по всем выпискам. */
@Service
@RequiredArgsConstructor
@Transactional
public class QuoteService {

    /**
     * Верхняя граница выдачи по всем выпискам: страница показывает их стеной, и на библиотеке
     * в тысячи записей отдавать всё разом нельзя — ни серверу, ни браузеру.
     */
    private static final int MAX_RESULTS = 500;

    private final QuoteRepository quoteRepository;
    private final LibraryItemRepository itemRepository;
    private final LibraryItemAccess itemAccess;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<QuoteResponse> findByItem( UUID itemId ) {
        itemAccess.requireReadable( itemId );
        return quoteRepository.findByItemIdOrderByPositionAscCreatedAtAsc( itemId ).stream()
                              .map( quote -> toResponse( quote, List.of() ) )
                              .toList();
    }

    /**
     * Выписки всей библиотеки: с запросом — поиск, без запроса — последние. Пустой ответ на
     * пустой запрос означал бы, что страница открывается ничем, а выписки перечитывают и просто
     * так — поэтому «ничего не спросили» здесь значит «покажите последние».
     * <p>
     * Обычный пользователь видит только свои: цитата — личная запись, а не общий справочник.
     */
    @Transactional( readOnly = true )
    public List<QuoteResponse> search( String query ) {
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();
        List<Quote> found = StringUtils.hasText( query )
                ? quoteRepository.search( query.trim(), scope, PageRequest.of( 0, MAX_RESULTS ) )
                : quoteRepository.findRecent( scope, PageRequest.of( 0, MAX_RESULTS ) );

        Map<UUID, List<String>> authors = authorNames( found );
        return found.stream()
                    .map( quote -> toResponse( quote, authors.getOrDefault( quote.getItem().getId(), List.of() ) ) )
                    .toList();
    }

    /**
     * Авторы книг найденных выписок — одним запросом на всю выдачу, а не по запросу на цитату.
     * Нужны списку книг: «Задача трёх тел» без «Лю Цысиня» в колонке книг ничем не отличается
     * от одноимённой чужой записи.
     */
    private Map<UUID, List<String>> authorNames( List<Quote> quotes ) {
        List<UUID> itemIds = quotes.stream().map( quote -> quote.getItem().getId() ).distinct().toList();
        if ( itemIds.isEmpty() ) {
            return Map.of();
        }
        Map<UUID, List<String>> byItem = new LinkedHashMap<>();
        for ( LibraryItemRepository.ItemAuthorRow row : itemRepository.findAuthorsByItemIds( itemIds ) ) {
            byItem.computeIfAbsent( row.getItemId(), key -> new java.util.ArrayList<>() ).add( row.getName() );
        }
        return byItem;
    }

    public QuoteResponse create( UUID itemId, QuoteRequest request ) {
        LibraryItem item = itemAccess.requireWritable( itemId, "Вы можете добавлять выписки только к своим книгам" );
        Quote quote = new Quote();
        quote.setItem( item );
        applyRequest( quote, request );
        return toResponse( quoteRepository.save( quote ), List.of() );
    }

    public Optional<QuoteResponse> update( UUID itemId, UUID quoteId, QuoteRequest request ) {
        itemAccess.requireWritable( itemId, "Вы можете править выписки только своих книг" );
        return quoteRepository.findById( quoteId )
                              .filter( quote -> quote.getItem().getId().equals( itemId ) )
                              .map( quote -> {
                                  applyRequest( quote, request );
                                  return toResponse( quoteRepository.save( quote ), List.of() );
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

    private QuoteResponse toResponse( Quote quote, List<String> itemAuthorNames ) {
        return QuoteResponse.builder()
                            .id( quote.getId() )
                            .itemId( quote.getItem().getId() )
                            .itemTitle( quote.getItem().getTitle() )
                            .itemAuthorNames( itemAuthorNames )
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
