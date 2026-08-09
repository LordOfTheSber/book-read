package com.library.tracker.service;

import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.ShelfRole;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.service.social.ActivityService;
import com.library.tracker.web.dto.ShelfItemResponse;
import com.library.tracker.web.dto.ShelfItemsRequest;
import com.library.tracker.web.dto.ShelfRequest;
import com.library.tracker.web.dto.ShelfResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
    private final ShelfMemberRepository shelfMemberRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;
    private final ShelfAccess shelfAccess;
    private final ActivityService activityService;

    /**
     * Свои полки и те, куда позвали. Совместная полка нужна её участнику там же, где своя, —
     * отдельным списком она превратилась бы в раздел, куда никто не заходит.
     */
    @Transactional( readOnly = true )
    public List<ShelfResponse> findAll() {
        User currentUser = userService.getCurrentUser();
        Map<UUID, Long> counts = itemCounts( currentUser.getId() );

        List<Shelf> own = shelfRepository.findByOwnerIdOrderByNameAsc( currentUser.getId() );
        List<ShelfMember> memberships = shelfMemberRepository.findByUserId( currentUser.getId() );

        // Счётчики участников — одним запросом на весь список: по запросу на полку страница
        // из двадцати полок стоила бы двадцати лишних обращений к базе.
        List<UUID> ids = Stream.concat( own.stream(), memberships.stream().map( ShelfMember::getShelf ) )
                               .map( Shelf::getId )
                               .toList();
        Map<UUID, Long> memberCounts = memberCounts( ids );

        List<ShelfResponse> responses = new ArrayList<>( own.size() + memberships.size() );
        own.forEach( shelf -> responses.add( toResponse( shelf,
                                                         counts.getOrDefault( shelf.getId(), 0L ),
                                                         currentUser,
                                                         null,
                                                         memberCounts.getOrDefault( shelf.getId(), 0L ) ) ) );
        memberships.forEach( membership -> {
            Shelf shelf = membership.getShelf();
            responses.add( toResponse( shelf,
                                       shelfRepository.countItems( shelf.getId() ),
                                       currentUser,
                                       membership.getRole(),
                                       memberCounts.getOrDefault( shelf.getId(), 0L ) ) ) ;
        } );
        responses.sort( Comparator.comparing( ShelfResponse::getName, String.CASE_INSENSITIVE_ORDER ) );
        return responses;
    }

    @Transactional( readOnly = true )
    public Optional<ShelfResponse> findById( UUID id ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id )
                              .filter( shelf -> shelfAccess.canRead( shelf, currentUser ) )
                              .map( shelf -> toResponse( shelf, shelf.getItems().size(), currentUser ) );
    }

    /** Состав полки. Владелец видит свою, участник — совместную, остальные — только публичную. */
    @Transactional( readOnly = true )
    public Optional<List<ShelfItemResponse>> findItems( UUID id ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id )
                              .filter( shelf -> shelfAccess.canRead( shelf, currentUser ) )
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
        return toResponse( shelfRepository.save( shelf ), 0, currentUser );
    }

    public Optional<ShelfResponse> update( UUID id, ShelfRequest request ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findWithItemsById( id ).map( shelf -> {
            requireCurator( shelf, currentUser );
            String name = request.getName().trim();
            // Уникальность названия — в пределах владельца полки, а не того, кто её сейчас правит:
            // куратор чужой полки не должен натыкаться на одноимённую полку в своей библиотеке.
            UUID ownerId = shelf.getOwner().getId();
            boolean shared = !shelf.isPublic() && request.isPublic();
            if ( !shelf.getName().equalsIgnoreCase( name )
                 && shelfRepository.existsByOwnerIdAndNameIgnoreCase( ownerId, name ) ) {
                throw new IllegalArgumentException( "Полка с таким названием уже есть" );
            }
            applyRequest( shelf, request );
            Shelf saved = shelfRepository.save( shelf );
            if ( shared ) {
                activityService.record( currentUser, ActivityType.SHARED_SHELF, null, saved, saved.getName(), null );
            }
            return toResponse( saved, saved.getItems().size(), currentUser );
        } );
    }

    /** Полка удаляется без произведений: она их только группирует. Удаляет владелец, не куратор. */
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
            if ( !shelfAccess.canContribute( shelf, currentUser ) ) {
                throw new AccessDeniedException( "Вы можете править состав только своих полок" );
            }
            // Чужое произведение на полке — это доступ к чужим данным через боковую дверь, поэтому
            // состав ограничен тем, что пользователю и так видно. Куратор совместной полки снимает
            // с неё что угодно, а участник — только то, что сам туда положил.
            boolean curator = shelfAccess.canCurate( shelf, currentUser );
            Set<LibraryItem> allowed = add || !curator
                    ? ownItems( request.getItemIds(), currentUser )
                    : new LinkedHashSet<>( libraryItemRepository.findAllById( request.getItemIds() ) );
            if ( add ) {
                shelf.getItems().addAll( allowed );
            } else {
                shelf.getItems().removeAll( allowed );
            }
            Shelf saved = shelfRepository.save( shelf );
            return toResponse( saved, saved.getItems().size(), currentUser );
        } );
    }

    private Set<LibraryItem> ownItems( List<UUID> itemIds, User currentUser ) {
        boolean isAdmin = userService.isAdmin( currentUser );
        return libraryItemRepository.findAllById( itemIds ).stream()
                                    .filter( item -> isAdmin || isOwnedBy( item, currentUser ) )
                                    .collect( Collectors.toCollection( LinkedHashSet::new ) );
    }

    private boolean isOwnedBy( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && item.getCreatedBy().getId().equals( user.getId() );
    }

    private void requireCurator( Shelf shelf, User currentUser ) {
        if ( !shelfAccess.canCurate( shelf, currentUser ) ) {
            throw new AccessDeniedException( "Вы можете править только свои полки" );
        }
    }

    private void requireOwner( Shelf shelf, User currentUser ) {
        if ( !shelfAccess.isOwner( shelf, currentUser ) ) {
            throw new AccessDeniedException( "Вы можете править только свои полки" );
        }
    }

    private Map<UUID, Long> memberCounts( List<UUID> shelfIds ) {
        if ( shelfIds.isEmpty() ) {
            return Map.of();
        }
        return shelfMemberRepository.countByShelfIds( shelfIds ).stream()
                                    .collect( Collectors.toMap( ShelfMemberRepository.ShelfCount::getShelfId,
                                                                ShelfMemberRepository.ShelfCount::getCount ) );
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

    private ShelfResponse toResponse( Shelf shelf, long itemCount, User currentUser ) {
        return toResponse( shelf,
                           itemCount,
                           currentUser,
                           shelfAccess.memberRole( shelf, currentUser ).orElse( null ),
                           shelf.getId() != null ? shelfMemberRepository.countByShelfId( shelf.getId() ) : 0 );
    }

    private ShelfResponse toResponse( Shelf shelf, long itemCount, User currentUser, ShelfRole myRole,
                                      long memberCount ) {
        boolean owned = shelfAccess.isOwner( shelf, currentUser );
        boolean curator = owned || myRole == ShelfRole.CURATOR;
        return ShelfResponse.builder()
                            .myRole( myRole )
                            .owned( owned )
                            .canCurate( curator )
                            .canContribute( curator || myRole == ShelfRole.CONTRIBUTOR )
                            .memberCount( memberCount )
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
