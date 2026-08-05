package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.LibraryItemRepository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class AuthorServiceTest {

    @Mock
    private AuthorRepository authorRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private UserService userService;

    private AuthorService service;

    @BeforeEach
    void setUp() {
        service = new AuthorService( authorRepository, libraryItemRepository, userService );
    }

    /** Автор — сущность, а не строка: одно и то же имя в разном регистре не должно двоиться. */
    @Test
    void resolveByNamesReusesExistingAuthorIgnoringCase() {
        Author existing = author( "Лю Цысинь" );
        when( authorRepository.findByNameIgnoreCase( eq( "лю цысинь" ) ) ).thenReturn( Optional.of( existing ) );

        Set<Author> resolved = service.resolveByNames( List.of( "лю цысинь" ) );

        assertThat( resolved ).containsExactly( existing );
        verify( authorRepository, never() ).save( any( Author.class ) );
    }

    @Test
    void resolveByNamesCreatesUnknownAuthor() {
        when( authorRepository.findByNameIgnoreCase( eq( "Новый автор" ) ) ).thenReturn( Optional.empty() );
        when( authorRepository.save( any( Author.class ) ) ).thenAnswer( invocation -> {
            Author author = invocation.getArgument( 0 );
            author.setId( UUID.randomUUID() );
            return author;
        } );

        Set<Author> resolved = service.resolveByNames( List.of( "  Новый автор  " ) );

        assertThat( resolved ).singleElement().extracting( Author::getName ).isEqualTo( "Новый автор" );
    }

    @Test
    void resolveByNamesSkipsBlanksAndDuplicates() {
        Author existing = author( "Лю Цысинь" );
        when( authorRepository.findByNameIgnoreCase( eq( "Лю Цысинь" ) ) ).thenReturn( Optional.of( existing ) );

        Set<Author> resolved = service.resolveByNames( List.of( "Лю Цысинь", "  ", "лю цысинь", "" ) );

        assertThat( resolved ).hasSize( 1 );
        verify( authorRepository, times( 1 ) ).findByNameIgnoreCase( any() );
    }

    @Test
    void deleteRejectsAuthorStillReferencedByItems() {
        UUID id = UUID.randomUUID();
        when( libraryItemRepository.existsByAuthorId( eq( id ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.delete( id ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "in use" );
        verify( authorRepository, never() ).deleteById( any() );
    }

    /** Обычный пользователь считает по своей библиотеке, администратор — по всей. */
    @Test
    void itemCountsAreScopedToOwnLibraryForRegularUser() {
        User currentUser = user( Role.USER );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( false );
        when( authorRepository.findAllByOrderByNameAsc() ).thenReturn( List.of() );
        when( libraryItemRepository.countByAuthor( eq( currentUser.getId() ) ) ).thenReturn( List.of() );

        service.findAll( null );

        verify( libraryItemRepository ).countByAuthor( eq( currentUser.getId() ) );
    }

    @Test
    void itemCountsCoverWholeBaseForAdmin() {
        User currentUser = user( Role.ADMIN );
        when( userService.getCurrentUser() ).thenReturn( currentUser );
        when( userService.isAdmin( eq( currentUser ) ) ).thenReturn( true );
        when( authorRepository.findAllByOrderByNameAsc() ).thenReturn( List.of() );
        when( libraryItemRepository.countByAuthor( eq( null ) ) ).thenReturn( List.of() );

        service.findAll( null );

        verify( libraryItemRepository ).countByAuthor( eq( null ) );
    }

    private Author author( String name ) {
        Author author = new Author();
        author.setId( UUID.randomUUID() );
        author.setName( name );
        return author;
    }

    private User user( Role role ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setRole( role );
        return user;
    }
}
