package com.library.tracker.service;

import com.library.tracker.domain.Source;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.web.dto.SourceRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

@ExtendWith( MockitoExtension.class )
class SourceServiceTest {

    @Mock
    private SourceRepository sourceRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Test
    void createRejectsDuplicateName() {
        SourceService service = new SourceService( sourceRepository, libraryItemRepository );
        SourceRequest request = new SourceRequest();
        request.setName( "Amazon" );

        when( sourceRepository.existsByNameIgnoreCase( eq( "Amazon" ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.create( request ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Source name already exists" );
    }

    @Test
    void updateRejectsDuplicateNameOnChange() {
        SourceService service = new SourceService( sourceRepository, libraryItemRepository );
        SourceRequest request = new SourceRequest();
        request.setName( "New Name" );

        Source existing = new Source();
        existing.setId( UUID.randomUUID() );
        existing.setName( "Old" );

        when( sourceRepository.findById( eq( existing.getId() ) ) ).thenReturn( Optional.of( existing ) );
        when( sourceRepository.existsByNameIgnoreCase( eq( "New Name" ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.update( existing.getId(), request ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Source name already exists" );
    }

    @Test
    void deleteRejectsSourcesInUse() {
        SourceService service = new SourceService( sourceRepository, libraryItemRepository );
        UUID sourceId = UUID.randomUUID();

        when( libraryItemRepository.existsBySourceId( eq( sourceId ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.delete( sourceId ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Cannot delete source in use" );
    }

    @Test
    void updateWritesFields() {
        SourceService service = new SourceService( sourceRepository, libraryItemRepository );
        SourceRequest request = new SourceRequest();
        request.setName( "New Name" );
        request.setUrl( "https://example.com" );
        request.setDescription( "desc" );

        Source existing = new Source();
        existing.setId( UUID.randomUUID() );
        existing.setName( "Old" );

        when( sourceRepository.findById( eq( existing.getId() ) ) ).thenReturn( Optional.of( existing ) );
        when( sourceRepository.save( any( Source.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        service.update( existing.getId(), request );

        verify( sourceRepository ).save( any( Source.class ) );
    }
}
