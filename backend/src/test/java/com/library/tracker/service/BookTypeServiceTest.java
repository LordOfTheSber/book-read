package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.BookTypeRequest;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class BookTypeServiceTest {

    @Mock
    private BookTypeRepository bookTypeRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Test
    void createRejectsDuplicateName() {
        BookTypeService service = new BookTypeService( bookTypeRepository, libraryItemRepository );
        BookTypeRequest request = new BookTypeRequest();
        request.setName( "Fiction" );

        when( bookTypeRepository.existsByNameIgnoreCase( eq( "Fiction" ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.create( request ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Type name already exists" );
    }

    @Test
    void updateRejectsDuplicateNameOnChange() {
        BookTypeService service = new BookTypeService( bookTypeRepository, libraryItemRepository );
        BookTypeRequest request = new BookTypeRequest();
        request.setName( "Sci-Fi" );

        BookType existing = new BookType();
        existing.setId( UUID.randomUUID() );
        existing.setName( "Old" );

        when( bookTypeRepository.findById( eq( existing.getId() ) ) ).thenReturn( Optional.of( existing ) );
        when( bookTypeRepository.existsByNameIgnoreCase( eq( "Sci-Fi" ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.update( existing.getId(), request ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Type name already exists" );
    }

    @Test
    void deleteRejectsTypesInUse() {
        BookTypeService service = new BookTypeService( bookTypeRepository, libraryItemRepository );
        UUID typeId = UUID.randomUUID();

        when( libraryItemRepository.existsByTypeId( eq( typeId ) ) ).thenReturn( true );

        assertThatThrownBy( () -> service.delete( typeId ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Cannot delete type in use" );
    }

    @Test
    void updateWritesFields() {
        BookTypeService service = new BookTypeService( bookTypeRepository, libraryItemRepository );
        BookTypeRequest request = new BookTypeRequest();
        request.setName( "Sci-Fi" );

        BookType existing = new BookType();
        existing.setId( UUID.randomUUID() );
        existing.setName( "Old" );

        when( bookTypeRepository.findById( eq( existing.getId() ) ) ).thenReturn( Optional.of( existing ) );
        when( bookTypeRepository.save( any( BookType.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        service.update( existing.getId(), request );

        verify( bookTypeRepository ).save( any( BookType.class ) );
    }
}
