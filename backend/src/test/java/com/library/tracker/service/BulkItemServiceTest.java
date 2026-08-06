package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.web.dto.BulkItemUpdateRequest;
import com.library.tracker.web.dto.BulkItemUpdateResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class BulkItemServiceTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed( Instant.parse( "2026-03-15T10:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private BookTypeRepository bookTypeRepository;

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private TagService tagService;

    @Mock
    private UserService userService;

    @Mock
    private ReadingProgressService readingProgressService;

    private BulkItemService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new BulkItemService( libraryItemRepository, bookTypeRepository, shelfRepository, tagService,
                                       userService, readingProgressService, FIXED_CLOCK );
        owner = user();
    }

    /** Выделение делают списком, поэтому чужая запись в нём не должна ронять весь запрос. */
    @Test
    void skipsForeignItemsInsteadOfFailing() {
        LibraryItem mine = item( "Моя", owner );
        LibraryItem foreign = item( "Чужая", user() );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( userService.isAdmin( eq( owner ) ) ).thenReturn( false );
        when( libraryItemRepository.findAllById( any() ) ).thenReturn( List.of( mine, foreign ) );

        BulkItemUpdateRequest request = new BulkItemUpdateRequest();
        request.setItemIds( List.of( mine.getId(), foreign.getId() ) );
        request.setFavorite( true );

        BulkItemUpdateResponse response = service.apply( request );

        assertThat( response.getUpdated() ).isEqualTo( 1 );
        assertThat( response.getSkipped() ).containsExactly( foreign.getId() );
        assertThat( mine.isFavorite() ).isTrue();
        assertThat( foreign.isFavorite() ).isFalse();
    }

    /** «Отметить прочитанным десять книг» должно проставить им и даты завершения. */
    @Test
    void statusChangeGoesThroughProgressTransition() {
        LibraryItem mine = item( "Моя", owner );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( userService.isAdmin( eq( owner ) ) ).thenReturn( false );
        when( libraryItemRepository.findAllById( any() ) ).thenReturn( List.of( mine ) );

        BulkItemUpdateRequest request = new BulkItemUpdateRequest();
        request.setItemIds( List.of( mine.getId() ) );
        request.setStatus( ReadingStatus.COMPLETED );

        service.apply( request );

        assertThat( mine.getStatus() ).isEqualTo( ReadingStatus.COMPLETED );
        verify( readingProgressService ).applyStatusTransition( eq( mine ), eq( ReadingStatus.PLANNED ),
                                                                eq( LocalDate.of( 2026, 3, 15 ) ) );
    }

    @Test
    void addsAndRemovesTags() {
        Tag summer = tag( "на лето" );
        Tag stale = tag( "старый" );
        LibraryItem mine = item( "Моя", owner );
        mine.getTags().add( stale );

        when( userService.getCurrentUser() ).thenReturn( owner );
        when( userService.isAdmin( eq( owner ) ) ).thenReturn( false );
        when( libraryItemRepository.findAllById( any() ) ).thenReturn( List.of( mine ) );
        when( tagService.resolveByNames( any(), eq( owner ) ) ).thenReturn( Set.of( summer ) );

        BulkItemUpdateRequest request = new BulkItemUpdateRequest();
        request.setItemIds( List.of( mine.getId() ) );
        request.setAddTagNames( List.of( "на лето" ) );
        request.setRemoveTagIds( List.of( stale.getId() ) );

        service.apply( request );

        assertThat( mine.getTags() ).containsExactly( summer );
    }

    private User user() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setRole( Role.USER );
        return user;
    }

    private LibraryItem item( String title, User createdBy ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setStatus( ReadingStatus.PLANNED );
        item.setCreatedBy( createdBy );
        return item;
    }

    private Tag tag( String name ) {
        Tag tag = new Tag();
        tag.setId( UUID.randomUUID() );
        tag.setName( name );
        return tag;
    }
}
