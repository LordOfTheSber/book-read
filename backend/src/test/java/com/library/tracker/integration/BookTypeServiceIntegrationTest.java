package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.service.BookTypeService;
import com.library.tracker.web.dto.BookTypeRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
// Без этого Spring Boot подменил бы контейнер встроенной БД.
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( { BookTypeService.class, JpaConfig.class } )
class BookTypeServiceIntegrationTest extends PostgresContainerTest {

    @Autowired
    private BookTypeService bookTypeService;

    @Autowired
    private BookTypeRepository bookTypeRepository;

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Test
    void createPersistsType() {
        BookTypeRequest request = new BookTypeRequest();
        request.setName( "Fiction" );

        var response = bookTypeService.create( request );

        assertThat( response.getId() ).isNotNull();
        assertThat( bookTypeRepository.findById( response.getId() ) ).isPresent();
    }

    @Test
    void deleteRejectsTypeWithItems() {
        BookType type = new BookType();
        type.setName( "Fiction" );
        type = bookTypeRepository.save( type );

        LibraryItem item = new LibraryItem();
        item.setTitle( "Title" );
        item.setType( type );
        item.setStatus( ReadingStatus.PLANNED );
        libraryItemRepository.save( item );

        BookType finalType = type;
        assertThatThrownBy( () -> bookTypeService.delete( finalType.getId() ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Cannot delete type in use" );
    }
}
