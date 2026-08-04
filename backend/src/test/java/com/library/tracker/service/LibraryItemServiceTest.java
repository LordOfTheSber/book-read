package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.storage.ObjectStorage;
import com.library.tracker.web.dto.LibraryItemRequest;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class LibraryItemServiceTest {

    /** Даты выставляет смена статуса, поэтому «сегодня» в тестах должно быть фиксированным. */
    private static final Clock FIXED_CLOCK =
            Clock.fixed( Instant.parse( "2026-03-15T10:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private BookTypeRepository bookTypeRepository;

    @Mock
    private SourceRepository sourceRepository;

    @Mock
    private AuthorService authorService;

    @Mock
    private SeriesService seriesService;

    @Mock
    private ObjectStorage objectStorage;

    @Mock
    private ReadingProgressService readingProgressService;

    @Mock
    private ReadingLogRepository readingLogRepository;

    @Mock
    private UserService userService;

    private LibraryItemService newService() {
        return new LibraryItemService( libraryItemRepository, bookTypeRepository, sourceRepository, authorService,
                                       seriesService, objectStorage, readingProgressService, readingLogRepository,
                                       FIXED_CLOCK, userService );
    }

    @Test
    void createDefaultsToBookKindWhenNull() {
        LibraryItemService service = newService();
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
        LibraryItemService service = newService();
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
        LibraryItemService service = newService();
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

        when( libraryItemRepository.findWithRelationsById( eq( item.getId() ) ) ).thenReturn( Optional.of( item ) );

        assertThatThrownBy( () -> service.delete( item.getId() ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Вы можете удалять только свои книги" );
    }

    @Test
    void updateRejectsNonOwners() {
        LibraryItemService service = newService();
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );

        User owner = new User();
        owner.setId( UUID.randomUUID() );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Чужая книга" );
        item.setCreatedBy( owner );

        when( libraryItemRepository.findWithRelationsById( eq( item.getId() ) ) ).thenReturn( Optional.of( item ) );

        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Перезаписано" );

        assertThatThrownBy( () -> service.update( item.getId(), request ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Вы можете редактировать только свои книги" );

        assertThat( item.getTitle() ).isEqualTo( "Чужая книга" );
        verify( libraryItemRepository, never() ).save( org.mockito.ArgumentMatchers.any( LibraryItem.class ) );
    }

    @Test
    void updateAllowsOwner() {
        LibraryItemService service = newService();
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );

        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Своя книга" );
        item.setCreatedBy( currentUser );

        when( libraryItemRepository.findWithRelationsById( eq( item.getId() ) ) ).thenReturn( Optional.of( item ) );
        when( libraryItemRepository.save( org.mockito.ArgumentMatchers.any( LibraryItem.class ) ) )
                .thenAnswer( invocation -> invocation.getArgument( 0 ) );

        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Обновлено" );

        var response = service.update( item.getId(), request );

        assertThat( response ).isPresent();
        assertThat( response.get().getTitle() ).isEqualTo( "Обновлено" );
    }

    @Test
    void updateAllowsAdminOnForeignItem() {
        LibraryItemService service = newService();
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setRole( Role.ADMIN );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( true );

        User owner = new User();
        owner.setId( UUID.randomUUID() );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Чужая книга" );
        item.setCreatedBy( owner );

        when( libraryItemRepository.findWithRelationsById( eq( item.getId() ) ) ).thenReturn( Optional.of( item ) );
        when( libraryItemRepository.save( org.mockito.ArgumentMatchers.any( LibraryItem.class ) ) )
                .thenAnswer( invocation -> invocation.getArgument( 0 ) );

        LibraryItemRequest request = new LibraryItemRequest();
        request.setTitle( "Обновлено администратором" );

        var response = service.update( item.getId(), request );

        assertThat( response ).isPresent();
        assertThat( response.get().getTitle() ).isEqualTo( "Обновлено администратором" );
    }

    @Test
    void analyticsRejectsUnauthorizedUserAccess() {
        LibraryItemService service = newService();
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
        LibraryItemService service = newService();
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
