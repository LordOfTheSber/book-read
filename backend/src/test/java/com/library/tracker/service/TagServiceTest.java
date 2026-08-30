package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.web.dto.TagDuplicateResponse;
import com.library.tracker.web.dto.TagRequest;

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
    private LibraryItemRepository itemRepository;

    @Mock
    private UserService userService;

    private TagService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new TagService( tagRepository, itemRepository, userService );
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
     * Объединение переносит пометки, а не удаляет их вместе с тегом: иначе «уборка» стоила бы
     * пользователю тех самых книг, ради которых он тег и заводил.
     */
    @Test
    void mergeMovesItemsToTargetAndRemovesSource() {
        Tag source = tag( "сай-фай", owner );
        Tag target = tag( "фантастика", owner );
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.getTags().add( source );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( source.getId() ) ) ).thenReturn( Optional.of( source ) );
        when( tagRepository.findById( eq( target.getId() ) ) ).thenReturn( Optional.of( target ) );
        when( itemRepository.findByTagId( eq( source.getId() ) ) ).thenReturn( List.of( item ) );
        when( tagRepository.countByTag( eq( owner.getId() ) ) ).thenReturn( List.of() );

        service.merge( source.getId(), target.getId() );

        assertThat( item.getTags() ).containsExactly( target );
        verify( tagRepository ).delete( source );
    }

    @Test
    void mergeOfForeignTagIsDenied() {
        Tag foreign = tag( "чужой", user() );
        Tag mine = tag( "мой", owner );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findById( eq( foreign.getId() ) ) ).thenReturn( Optional.of( foreign ) );
        when( tagRepository.findById( eq( mine.getId() ) ) ).thenReturn( Optional.of( mine ) );

        assertThatThrownBy( () -> service.merge( foreign.getId(), mine.getId() ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( tagRepository, never() ).delete( any( Tag.class ) );
    }

    /**
     * Дубль виден по пересечению, а не по написанию: «сай-фай» почти целиком лежит внутри
     * «фантастики», а «космос» с ней просто соседствует.
     */
    @Test
    void findDuplicatesKeepsOnlyPairsThatOverlapAlmostEntirely() {
        Tag small = tag( "сай-фай", owner );
        Tag big = tag( "фантастика", owner );
        Tag neighbour = tag( "космос", owner );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findByOwnerIdOrderByNameAsc( eq( owner.getId() ) ) )
                .thenReturn( List.of( small, big, neighbour ) );
        when( tagRepository.countByTag( eq( owner.getId() ) ) )
                .thenReturn( List.of( count( small.getId(), 9 ), count( big.getId(), 64 ),
                                      count( neighbour.getId(), 27 ) ) );
        when( tagRepository.overlaps( eq( owner.getId() ) ) )
                .thenReturn( List.of( overlap( small.getId(), big.getId(), 7 ),
                                      overlap( big.getId(), small.getId(), 7 ),
                                      overlap( neighbour.getId(), big.getId(), 8 ) ) );

        List<TagDuplicateResponse> duplicates = service.findDuplicates();

        assertThat( duplicates ).singleElement().satisfies( duplicate -> {
            assertThat( duplicate.getSource().getName() ).isEqualTo( "сай-фай" );
            assertThat( duplicate.getTarget().getName() ).isEqualTo( "фантастика" );
            assertThat( duplicate.getOverlap() ).isEqualTo( 7 );
        } );
    }

    /**
     * Запрос отдаёт пару в обоих порядках, и при равных счётчиках «меньший» определялся тем,
     * какая строка пришла первой: одно и то же подозрение показывалось дважды.
     */
    @Test
    void findDuplicatesShowsMirroredPairOnce() {
        Tag older = tag( "фантастика", owner );
        older.setCreatedAt( java.time.LocalDateTime.of( 2026, 1, 1, 10, 0 ) );
        Tag newer = tag( "сай-фай", owner );
        newer.setCreatedAt( java.time.LocalDateTime.of( 2026, 5, 1, 10, 0 ) );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( tagRepository.findByOwnerIdOrderByNameAsc( eq( owner.getId() ) ) ).thenReturn( List.of( older, newer ) );
        when( tagRepository.countByTag( eq( owner.getId() ) ) )
                .thenReturn( List.of( count( older.getId(), 4 ), count( newer.getId(), 4 ) ) );
        when( tagRepository.overlaps( eq( owner.getId() ) ) )
                .thenReturn( List.of( overlap( older.getId(), newer.getId(), 4 ),
                                      overlap( newer.getId(), older.getId(), 4 ) ) );

        List<TagDuplicateResponse> duplicates = service.findDuplicates();

        // Лишний при равных счётчиках — заведённый позже: старый успел разойтись по записям.
        assertThat( duplicates ).singleElement().satisfies( duplicate -> {
            assertThat( duplicate.getSource().getName() ).isEqualTo( "сай-фай" );
            assertThat( duplicate.getTarget().getName() ).isEqualTo( "фантастика" );
        } );
    }

    private TagRepository.TagCount count( UUID tagId, long value ) {
        return new TagRepository.TagCount() {

            @Override
            public UUID getTagId() {
                return tagId;
            }

            @Override
            public long getCount() {
                return value;
            }
        };
    }

    private TagRepository.TagOverlap overlap( UUID first, UUID second, long value ) {
        return new TagRepository.TagOverlap() {

            @Override
            public UUID getFirstId() {
                return first;
            }

            @Override
            public UUID getSecondId() {
                return second;
            }

            @Override
            public long getOverlap() {
                return value;
            }
        };
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
