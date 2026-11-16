package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.web.dto.TagRequest;
import com.library.tracker.web.dto.TagResponse;

import java.util.List;
import java.util.Optional;
import java.util.Set;
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
class TagServiceTest {

    @Mock
    private TagRepository tagRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private UserService userService;

    private TagService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new TagService( tagRepository, libraryItemRepository, userService );
        owner = user();
    }

    /** Тег заводится по имени прямо из карточки, и «На лето» с «на лето» — одна и та же пометка. */
    @Test
    void resolveByNamesReusesExistingTagIgnoringCase() {
        Tag existing = tag( "на лето", owner );
        when( tagRepository.findByOwnerIdAndNameIgnoreCase( eq( owner.getId() ), eq( "На лето" ) ) )
                .thenReturn( Optional.of( existing ) );

        Set<Tag> resolved = service.resolveByNames( List.of( "На лето", "  на лето  " ), owner );

        assertThat( resolved ).containsExactly( existing );
        verify( tagRepository, never() ).save( any( Tag.class ) );
    }

    @Test
    void resolveByNamesCreatesMissingTagForOwner() {
        when( tagRepository.findByOwnerIdAndNameIgnoreCase( eq( owner.getId() ), eq( "перечитать" ) ) )
                .thenReturn( Optional.empty() );
        when( tagRepository.save( any( Tag.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        Set<Tag> resolved = service.resolveByNames( List.of( "перечитать" ), owner );

        assertThat( resolved ).hasSize( 1 );
        // Тег личный: заведённый на чужого владельца, он засветил бы одну библиотеку в другой.
        assertThat( resolved.iterator().next().getOwner() ).isSameAs( owner );
    }

    /** Тег «на лето» у двух пользователей — разные пометки, и править чужую нельзя. */
    @Test
    void updateOfForeignTagIsDenied() {
        Tag foreign = tag( "на лето", user() );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        TagRequest request = new TagRequest();
        request.setName( "чужой" );

        assertThatThrownBy( () -> service.update( foreign.getId(), request ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( tagRepository, never() ).save( any( Tag.class ) );
    }

    @Test
    void deleteOfForeignTagIsDenied() {
        Tag foreign = tag( "на лето", user() );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        assertThatThrownBy( () -> service.delete( foreign.getId() ) ).isInstanceOf( AccessDeniedException.class );
        verify( tagRepository, never() ).delete( any( Tag.class ) );
    }

    @Test
    void createRejectsDuplicateName() {
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.existsByOwnerIdAndNameIgnoreCase( eq( owner.getId() ), eq( "на лето" ) ) )
                .thenReturn( true );

        TagRequest request = new TagRequest();
        request.setName( "на лето" );

        assertThatThrownBy( () -> service.create( request ) ).isInstanceOf( IllegalArgumentException.class );
    }

    /**
     * «сай-фай» и «фантастика» — одна пометка, разведённая по двум тегам вводом из карточки.
     * Объединение переносит пометки и удаляет уходящий тег.
     */
    @Test
    void mergeMovesMarksToTargetTag() {
        Tag into = tag( "фантастика", owner );
        Tag from = tag( "сай-фай", owner );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.getTags().add( from );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( into.getId() ) ) ).thenReturn( Optional.of( into ) );
        when( tagRepository.findById( eq( from.getId() ) ) ).thenReturn( Optional.of( from ) );
        when( libraryItemRepository.findByTagId( eq( from.getId() ) ) ).thenReturn( List.of( item ) );
        when( tagRepository.countByTag( eq( owner.getId() ) ) ).thenReturn( List.of() );

        TagResponse merged = service.merge( into.getId(), from.getId() ).orElseThrow();

        assertThat( merged.getName() ).isEqualTo( "фантастика" );
        assertThat( item.getTags() ).containsExactly( into );
        verify( tagRepository ).delete( eq( from ) );
    }

    /** Тег личный: объединить чужой со своим — то же, что удалить чужой. */
    @Test
    void mergeRejectsForeignTag() {
        Tag mine = tag( "фантастика", owner );
        Tag foreign = tag( "сай-фай", user() );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( mine.getId() ) ) ).thenReturn( Optional.of( mine ) );
        when( tagRepository.findById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );

        assertThatThrownBy( () -> service.merge( mine.getId(), foreign.getId() ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( tagRepository, never() ).delete( any( Tag.class ) );
    }

    private User user() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setRole( Role.USER );
        return user;
    }

    private Tag tag( String name, User owner ) {
        Tag tag = new Tag();
        tag.setId( UUID.randomUUID() );
        tag.setName( name );
        tag.setOwner( owner );
        return tag;
    }
}
