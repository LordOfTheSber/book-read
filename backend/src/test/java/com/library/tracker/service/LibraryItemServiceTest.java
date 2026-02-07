package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.web.dto.LibraryItemRequest;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class LibraryItemServiceTest {

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private BookTypeRepository bookTypeRepository;

    @Mock
    private SourceRepository sourceRepository;

    @Mock
    private UserService userService;

    @Test
    void createDefaultsToBookKindWhenNull() {
        LibraryItemService service = new LibraryItemService(
                libraryItemRepository,
                bookTypeRepository,
                sourceRepository,
                userService
        );
        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Test" );
        request.setKind( null );

        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( libraryItemRepository.save( org.mockito.ArgumentMatchers.any( LibraryItem.class ) ) )
                .thenAnswer( invocation -> invocation.getArgument( 0 ) );

        var response = service.create( request );

        assertThat( response.getKind() ).isEqualTo( MediaKind.BOOK );
    }

    @Test
    void createFailsWhenTypeMissing() {
        LibraryItemService service = new LibraryItemService(
                libraryItemRepository,
                bookTypeRepository,
                sourceRepository,
                userService
        );
        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Test" );
        request.setTypeId( UUID.randomUUID() );

        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );

        when( bookTypeRepository.findById( eq( request.getTypeId() ) ) ).thenReturn( Optional.empty() );

        assertThatThrownBy( () -> service.create( request ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Type not found" );
    }

    @Test
    void deleteRejectsNonOwners() {
        LibraryItemService service = new LibraryItemService(
                libraryItemRepository,
                bookTypeRepository,
                sourceRepository,
                userService
        );
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );

        User owner = new User();
        owner.setId( UUID.randomUUID() );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setCreatedBy( owner );

        when( libraryItemRepository.findById( eq( item.getId() ) ) ).thenReturn( Optional.of( item ) );

        assertThatThrownBy( () -> service.delete( item.getId() ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Вы можете удалять только свои книги" );
    }

    @Test
    void analyticsRejectsUnauthorizedUserAccess() {
        LibraryItemService service = new LibraryItemService(
                libraryItemRepository,
                bookTypeRepository,
                sourceRepository,
                userService
        );
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );

        assertThatThrownBy( () -> service.getAnalytics( Optional.of( UUID.randomUUID() ) ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Недостаточно прав для просмотра аналитики другого пользователя" );
    }

    @Test
    void createUsesTypeAndSourceWhenProvided() {
        LibraryItemService service = new LibraryItemService(
                libraryItemRepository,
                bookTypeRepository,
                sourceRepository,
                userService
        );
        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Test" );
        request.setTypeId( UUID.randomUUID() );

        BookType type = new BookType();
        type.setId( request.getTypeId() );
        type.setName( "Type" );

        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );

        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( bookTypeRepository.findById( eq( request.getTypeId() ) ) ).thenReturn( Optional.of( type ) );
        when( libraryItemRepository.save( org.mockito.ArgumentMatchers.any( LibraryItem.class ) ) )
                .thenAnswer( invocation -> invocation.getArgument( 0 ) );

        var response = service.create( request );

        assertThat( response.getTypeId() ).isEqualTo( type.getId() );
        assertThat( response.getTypeName() ).isEqualTo( "Type" );
    }
}
