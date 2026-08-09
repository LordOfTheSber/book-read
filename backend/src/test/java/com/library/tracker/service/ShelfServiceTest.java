package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.service.social.ActivityService;
import com.library.tracker.web.dto.ShelfItemsRequest;
import com.library.tracker.web.dto.ShelfRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ShelfServiceTest {

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private ShelfMemberRepository shelfMemberRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private UserService userService;

    @Mock
    private ActivityService activityService;

    private ShelfService service;

    private User owner;

    @BeforeEach
    void setUp() {
        ShelfAccess shelfAccess = new ShelfAccess( shelfMemberRepository, userService );
        service = new ShelfService( shelfRepository, shelfMemberRepository, libraryItemRepository, userService,
                                    shelfAccess, activityService );
        owner = user();
    }

    @Test
    void updateOfForeignShelfIsDenied() {
        Shelf foreign = shelf( "Подарить", user(), false );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( shelfRepository.findWithItemsById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        ShelfRequest request = new ShelfRequest();
        request.setName( "Моя" );

        assertThatThrownBy( () -> service.update( foreign.getId(), request ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( shelfRepository, never() ).save( any( Shelf.class ) );
    }

    /** Приватная чужая полка не должна отличаться от несуществующей. */
    @Test
    void privateForeignShelfIsInvisible() {
        Shelf foreign = shelf( "Подарить", user(), false );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( userService.isAdmin( eq( owner ) ) ).thenReturn( false );
        when( shelfRepository.findWithItemsById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        assertThat( service.findById( foreign.getId() ) ).isEmpty();
    }

    @Test
    void publicForeignShelfIsReadable() {
        Shelf foreign = shelf( "Книжный клуб", user(), true );
        foreign.getItems().add( item( "Задача трёх тел" ) );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( shelfRepository.findWithItemsById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        assertThat( service.findItems( foreign.getId() ) ).isPresent()
                                                          .get( org.assertj.core.api.InstanceOfAssertFactories.LIST )
                                                          .hasSize( 1 );
    }

    /** Чужая запись на своей полке — это доступ к чужим данным через боковую дверь. */
    @Test
    void addItemsKeepsOnlyOwnItems() {
        Shelf own = shelf( "Подарить", owner, false );
        LibraryItem mine = item( "Моя" );
        mine.setCreatedBy( owner );
        LibraryItem foreign = item( "Чужая" );
        foreign.setCreatedBy( user() );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( userService.isAdmin( eq( owner ) ) ).thenReturn( false );
        when( shelfRepository.findWithItemsById( eq( own.getId() ) ) ).thenReturn( Optional.of( own ) );
        when( libraryItemRepository.findAllById( any() ) ).thenReturn( List.of( mine, foreign ) );
        when( shelfRepository.save( any( Shelf.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        ShelfItemsRequest request = new ShelfItemsRequest();
        request.setItemIds( List.of( mine.getId(), foreign.getId() ) );
        service.addItems( own.getId(), request );

        assertThat( own.getItems() ).containsExactly( mine );
    }

    private User user() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setRole( Role.USER );
        return user;
    }

    private Shelf shelf( String name, User owner, boolean isPublic ) {
        Shelf shelf = new Shelf();
        shelf.setId( UUID.randomUUID() );
        shelf.setName( name );
        shelf.setOwner( owner );
        shelf.setPublic( isPublic );
        return shelf;
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setStatus( ReadingStatus.PLANNED );
        return item;
    }
}
