package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.web.dto.BulkItemDeletePreviewResponse;
import com.library.tracker.web.dto.BulkItemDeleteResponse;
import com.library.tracker.web.dto.BulkItemUpdateRequest;
import com.library.tracker.web.dto.BulkItemUpdateResponse;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Массовые операции: проставить статус, тег или полку сразу нескольким записям. Без них
 * разбор свежего импорта в полсотни строк превращается в полсотни открытых карточек.
 * <p>
 * Чужие записи не правятся и не роняют запрос: они возвращаются списком пропущенных, потому что
 * выделение обычно делается по списку, а не поимённо.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BulkItemService {

    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;
    private final ShelfRepository shelfRepository;
    private final QuoteRepository quoteRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final LibraryItemService libraryItemService;
    private final TagService tagService;
    private final UserService userService;
    private final ReadingProgressService readingProgressService;
    private final Clock clock;

    public BulkItemUpdateResponse apply( BulkItemUpdateRequest request ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        List<LibraryItem> items = libraryItemRepository.findAllById( request.getItemIds() );
        List<UUID> skipped = new ArrayList<>( request.getItemIds() );

        Set<Tag> addedTags = tagService.resolveByNames( request.getAddTagNames(), currentUser );
        BookType type = resolveType( request.getTypeId() );
        Shelf addToShelf = resolveOwnShelf( request.getAddToShelfId(), currentUser );
        Shelf removeFromShelf = resolveOwnShelf( request.getRemoveFromShelfId(), currentUser );

        List<LibraryItem> updated = new ArrayList<>();
        for ( LibraryItem item : items ) {
            if ( !isAdmin && !isOwnedBy( item, currentUser ) ) {
                continue;
            }
            skipped.remove( item.getId() );
            applyTo( item, request, addedTags, type );
            updated.add( item );
        }

        libraryItemRepository.saveAll( updated );

        if ( addToShelf != null ) {
            addToShelf.getItems().addAll( updated );
            shelfRepository.save( addToShelf );
        }
        if ( removeFromShelf != null ) {
            removeFromShelf.getItems().removeAll( updated );
            shelfRepository.save( removeFromShelf );
        }

        return BulkItemUpdateResponse.builder().updated( updated.size() ).skipped( skipped ).build();
    }

    /**
     * Что исчезнет вместе с записями. Считается до удаления и показывается числами: сами записи
     * заводятся заново за минуту, а выписки и заходы — это то, что человек вводил руками.
     */
    @Transactional( readOnly = true )
    public BulkItemDeletePreviewResponse previewDelete( List<UUID> itemIds ) {
        List<LibraryItem> deletable = deletable( itemIds );
        if ( deletable.isEmpty() ) {
            return BulkItemDeletePreviewResponse.builder().items( 0 ).skipped( itemIds.size() ).build();
        }
        List<UUID> ids = deletable.stream().map( LibraryItem::getId ).toList();
        long reviews = deletable.stream().filter( item -> StringUtils.hasText( item.getReview() ) ).count();

        return BulkItemDeletePreviewResponse.builder()
                                            .items( ids.size() )
                                            .skipped( itemIds.size() - ids.size() )
                                            .quotes( quoteRepository.countByItems( ids ) )
                                            .itemsWithQuotes( quoteRepository.countItemsWithQuotes( ids ) )
                                            .sessions( readingSessionRepository.countByItems( ids ) )
                                            .reviews( reviews )
                                            .build();
    }

    /**
     * Массовое удаление. Каждая запись уходит через {@code LibraryItemService}: у неё есть обложка
     * вне базы, и удаление в обход сервиса оставило бы файлы сиротами.
     */
    public BulkItemDeleteResponse delete( List<UUID> itemIds ) {
        List<UUID> ids = deletable( itemIds ).stream().map( LibraryItem::getId ).toList();
        ids.forEach( libraryItemService::delete );
        return BulkItemDeleteResponse.builder().deleted( ids.size() ).skipped( itemIds.size() - ids.size() ).build();
    }

    /** Чужие записи не удаляются и не роняют запрос: выделение делается по списку, а не поимённо. */
    private List<LibraryItem> deletable( List<UUID> itemIds ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );
        return libraryItemRepository.findAllById( itemIds ).stream()
                                    .filter( item -> isAdmin || isOwnedBy( item, currentUser ) )
                                    .toList();
    }

    private void applyTo( LibraryItem item, BulkItemUpdateRequest request, Set<Tag> addedTags, BookType type ) {
        if ( request.getStatus() != null ) {
            ReadingStatus previous = item.getStatus();
            item.setStatus( request.getStatus() );
            // Даты и проходы ведёт смена статуса — массовая правка не исключение,
            // иначе «отметить прочитанным десять книг» оставило бы их без даты завершения.
            readingProgressService.applyStatusTransition( item, previous, LocalDate.now( clock ) );
        }
        if ( request.getFavorite() != null ) {
            item.setFavorite( request.getFavorite() );
        }
        if ( request.getWishlist() != null ) {
            item.setWishlist( request.getWishlist() );
        }
        if ( type != null ) {
            item.setType( type );
        }
        if ( !addedTags.isEmpty() ) {
            Set<Tag> tags = new LinkedHashSet<>( item.getTags() );
            tags.addAll( addedTags );
            item.setTags( tags );
        }
        if ( request.getRemoveTagIds() != null && !request.getRemoveTagIds().isEmpty() ) {
            Set<Tag> tags = new LinkedHashSet<>( item.getTags() );
            tags.removeIf( tag -> request.getRemoveTagIds().contains( tag.getId() ) );
            item.setTags( tags );
        }
    }

    private BookType resolveType( UUID typeId ) {
        if ( typeId == null ) {
            return null;
        }
        return bookTypeRepository.findById( typeId )
                                 .orElseThrow( () -> new IllegalArgumentException( "Type not found" ) );
    }

    private Shelf resolveOwnShelf( UUID shelfId, User currentUser ) {
        if ( shelfId == null ) {
            return null;
        }
        Shelf shelf = shelfRepository.findWithItemsById( shelfId )
                                     .orElseThrow( () -> new IllegalArgumentException( "Полка не найдена" ) );
        if ( shelf.getOwner() == null || !shelf.getOwner().getId().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Вы можете править только свои полки" );
        }
        return shelf;
    }

    private boolean isOwnedBy( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && item.getCreatedBy().getId().equals( user.getId() );
    }
}
