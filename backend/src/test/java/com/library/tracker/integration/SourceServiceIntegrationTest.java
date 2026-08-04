package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Source;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.service.SourceService;
import com.library.tracker.web.dto.SourceRequest;

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
@Import( { SourceService.class, JpaConfig.class } )
class SourceServiceIntegrationTest extends PostgresContainerTest {

    @Autowired
    private SourceService sourceService;

    @Autowired
    private SourceRepository sourceRepository;

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Test
    void createPersistsSource() {
        SourceRequest request = new SourceRequest();
        request.setName( "Store" );
        request.setUrl( "https://example.com" );
        request.setDescription( "desc" );

        var response = sourceService.create( request );

        assertThat( response.getId() ).isNotNull();
        assertThat( sourceRepository.findById( response.getId() ) ).isPresent();
    }

    @Test
    void deleteRejectsSourceWithItems() {
        Source source = new Source();
        source.setName( "Store" );
        source.setUrl( "https://example.com" );
        source.setDescription( "desc" );
        source = sourceRepository.save( source );

        LibraryItem item = new LibraryItem();
        item.setTitle( "Title" );
        item.setSource( source );
        item.setStatus( ReadingStatus.PLANNED );
        libraryItemRepository.save( item );

        Source finalSource = source;
        assertThatThrownBy( () -> sourceService.delete( finalSource.getId() ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Cannot delete source in use" );
    }
}
