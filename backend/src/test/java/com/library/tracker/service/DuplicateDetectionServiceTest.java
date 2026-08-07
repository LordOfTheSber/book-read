package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.DuplicateCandidateResponse;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class DuplicateDetectionServiceTest {

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private UserService userService;

    private DuplicateDetectionService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new DuplicateDetectionService( libraryItemRepository, userService );
        owner = user();
    }

    /** ISBN печатают с дефисами как попало: сравнивать имеет смысл только цифры. */
    @Test
    void normalizesIsbnBeforeLookup() {
        LibraryItem existing = item( "Задача трёх тел" );
        when( libraryItemRepository.findByNormalizedIsbn( eq( "9785171049676" ), eq( owner.getId() ) ) )
                .thenReturn( List.of( existing ) );

        List<DuplicateCandidateResponse> found = service.findDuplicates( "978-5-17-104967-6", null, owner );

        assertThat( found ).hasSize( 1 );
        assertThat( found.get( 0 ).getReason() ).isEqualTo( DuplicateCandidateResponse.MatchReason.ISBN );
    }

    /** Совпадение по ISBN сильнее совпадения по названию и должно пережить пересечение выдач. */
    @Test
    void keepsStrongerReasonWhenBothMatch() {
        LibraryItem existing = item( "Задача трёх тел" );
        when( libraryItemRepository.findByNormalizedIsbn( any(), eq( owner.getId() ) ) )
                .thenReturn( List.of( existing ) );
        when( libraryItemRepository.findSimilarByTitle( eq( "Задача трех тел" ), eq( owner.getId() ) ) )
                .thenReturn( List.of( existing ) );

        List<DuplicateCandidateResponse> found = service.findDuplicates( "9785171049676", "Задача трех тел", owner );

        assertThat( found ).hasSize( 1 );
        assertThat( found.get( 0 ).getReason() ).isEqualTo( DuplicateCandidateResponse.MatchReason.ISBN );
    }

    @Test
    void withoutIsbnAndTitleNothingIsQueried() {
        assertThat( service.findDuplicates( "  ", null, owner ) ).isEmpty();
        verify( libraryItemRepository, never() ).findByNormalizedIsbn( any(), any() );
        verify( libraryItemRepository, never() ).findSimilarByTitle( any(), any() );
    }

    private User user() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setRole( Role.USER );
        return user;
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setIsbn( "9785171049676" );
        item.setStatus( ReadingStatus.PLANNED );
        return item;
    }
}
