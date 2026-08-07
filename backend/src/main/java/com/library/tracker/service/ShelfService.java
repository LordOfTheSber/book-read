package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.web.dto.ShelfItemResponse;
import com.library.tracker.web.dto.ShelfItemsRequest;
import com.library.tracker.web.dto.ShelfRequest;
import com.library.tracker.web.dto.ShelfResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Полки и коллекции: именованные наборы с описанием. Состав задаётся вручную — этим полка
 * отличается от умной, где он пересчитывается по сохранённому фильтру.
 * <p>
 * Публичная полка открыта любому пользователю сервиса, но не анонимному: роадмеп прямо оговаривает,
 * что новые точки доступа к чужим данным добавляются осторожно.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ShelfService {

    private final ShelfRepository shelfRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<ShelfResponse> findAll() {
        User currentUser = userService.getCurrentUser();
        Map<UUID, Long> counts = itemCounts( currentUser.getId() );
        return shelfRepository.findByOwnerIdOrderByNameAsc( currentUser.getId() ).stream()
                              .map( shelf -> toResponse( shelf, counts.getOrDefault( shelf.getId(), 0L ) ) )
                              .toList();
    }

    @Transactional( readOnly = true )
    public Optional<ShelfResponse> findById( UUID id ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id )
                              .filter( shelf -> isReadable( shelf, currentUser ) )
                              .map( shelf -> toResponse( shelf, shelf.getItems().size() ) );
    }

    /** Состав полки. Владелец видит свою, остальные — только публичную. */
    @Transactional( readOnly = true )
    public Optional<List<ShelfItemResponse>> findItems( UUID id ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id )
                              .filter( shelf -> isReadable( shelf, currentUser ) )
                              .map( shelf -> shelf.getItems().stream()
                                                  .sorted( Comparator.comparing( LibraryItem::getTitle,
                                                                                 String.CASE_INSENSITIVE_ORDER ) )
                                                  .map( this::toItemResponse )
                                                  .toList() );
    }

    public ShelfResponse create( ShelfRequest request ) {
        User currentUser = userService.getCurrentUser();
        String name = request.getName().trim();
        if ( shelfRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
            throw new IllegalArgumentException( "Полка с таким названием уже есть" );
        }
        Shelf shelf = new Shelf();
        shelf.setOwner( currentUser );
        applyRequest( shelf, request );
        return toResponse( shelfRepository.save( shelf ), 0 );
    }

    public Optional<ShelfResponse> update( UUID id, ShelfRequest request ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id ).map( shelf -> {
            requireOwner( shelf, currentUser );
            String name = request.getName().trim();
            if ( !shelf.getName().equalsIgnoreCase( name )
                 && shelfRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
                throw new IllegalArgumentException( "Полка с таким названием уже есть" );
            }
            applyRequest( shelf, request );
            return toResponse( shelfRepository.save( shelf ), shelf.getItems().size() );
        } );
    }

    /** Полка удаляется без произведений: она их только группирует. */
    public void delete( UUID id ) {
        User currentUser = userService.getCurrentUser();
        shelfRepository.findById( id ).ifPresent( shelf -> {
            requireOwner( shelf, currentUser );
            shelfRepository.delete( shelf );
        } );
    }

    public Optional<ShelfResponse> addItems( UUID id, ShelfItemsRequest request ) {
        return modifyItems( id, request, true );
    }

    public Optional<ShelfResponse> removeItems( UUID id, ShelfItemsRequest request ) {
        return modifyItems( id, request, false );
    }

    private Optional<ShelfResponse> modifyItems( UUID id, ShelfItemsRequest request, boolean add ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id ).map( shelf -> {
            requireOwner( shelf, currentUser );
            // Чужое произведение на своей полке — это доступ к чужим данным через боковую дверь,
            // поэтому состав ограничен тем, что пользователю и так видно.
            Set<LibraryItem> allowed = readableItems( request.getItemIds(), currentUser );
            if ( add ) {
                shelf.getItems().addAll( allowed );
            } else {
                shelf.getItems().removeAll( allowed );
            }
            return toResponse( shelfRepository.save( shelf ), shelf.getItems().size() );
        } );
    }

    private Set<LibraryItem> readableItems( List<UUID> itemIds, User currentUser ) {
        boolean isAdmin = userService.isAdmin( currentUser );
        return libraryItemRepository.findAllById( itemIds ).stream()
                                    .filter( item -> isAdmin || isOwnedBy( item, currentUser ) )
                                    .collect( Collectors.toCollection( java.util.LinkedHashSet::new ) );
    }

    private boolean isOwnedBy( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && item.getCreatedBy().getId().equals( user.getId() );
    }

    private boolean isReadable( Shelf shelf, User currentUser ) {
        return shelf.isPublic()
               || userService.isAdmin( currentUser )
               || ( shelf.getOwner() != null && shelf.getOwner().getId().equals( currentUser.getId() ) );
    }

    private void requireOwner( Shelf shelf, User currentUser ) {
        if ( shelf.getOwner() == null || !shelf.getOwner().getId().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Вы можете править только свои полки" );
        }
    }

    private Map<UUID, Long> itemCounts( UUID ownerId ) {
        return shelfRepository.countItemsByShelf( ownerId ).stream()
                              .collect( Collectors.toMap( ShelfRepository.ShelfCount::getShelfId,
                                                          ShelfRepository.ShelfCount::getCount ) );
    }

    private void applyRequest( Shelf shelf, ShelfRequest request ) {
        shelf.setName( request.getName().trim() );
        shelf.setDescription( StringUtils.hasText( request.getDescription() )
                                      ? request.getDescription().trim()
                                      : null );
        shelf.setPublic( request.isPublic() );
    }

    private ShelfResponse toResponse( Shelf shelf, long itemCount ) {
        return ShelfResponse.builder()
                            .id( shelf.getId() )
                            .name( shelf.getName() )
                            .description( shelf.getDescription() )
                            .isPublic( shelf.isPublic() )
                            .itemCount( itemCount )
                            .ownerId( shelf.getOwner() != null ? shelf.getOwner().getId() : null )
                            .ownerUsername( shelf.getOwner() != null ? shelf.getOwner().getUsername() : null )
                            .createdAt( toOffsetDateTime( shelf.getCreatedAt() ) )
                            .updatedAt( toOffsetDateTime( shelf.getUpdatedAt() ) )
                            .build();
    }

    private ShelfItemResponse toItemResponse( LibraryItem item ) {
        return ShelfItemResponse.builder()
                                .id( item.getId() )
                                .kind( item.getKind() )
                                .title( item.getTitle() )
                                .altTitle( item.getAltTitle() )
                                .authorNames( item.getAuthors().stream()
                                                  .map( Author::getName )
                                                  .sorted( String.CASE_INSENSITIVE_ORDER )
                                                  .toList() )
                                .hasCover( item.getCoverKey() != null )
                                .rating( item.getRating() )
                                .status( item.getStatus() )
                                .review( item.getReview() )
                                .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
