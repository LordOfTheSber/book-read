package com.library.tracker.service;

import com.library.tracker.domain.Source;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.web.dto.SourceRequest;
import com.library.tracker.web.dto.SourceResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class SourceService {

    private final SourceRepository sourceRepository;
    private final LibraryItemRepository libraryItemRepository;

    public List<SourceResponse> findAll() {
        return sourceRepository.findAll()
                               .stream()
                               .map( this::toResponse )
                               .toList();
    }

    public SourceResponse create( SourceRequest request ) {
        if ( sourceRepository.existsByNameIgnoreCase( request.getName() ) ) {
            throw new IllegalArgumentException( "Source name already exists" );
        }
        Source source = new Source();
        applyRequest( source, request );
        return toResponse( sourceRepository.save( source ) );
    }

    public Optional<SourceResponse> update( UUID id, SourceRequest request ) {
        return sourceRepository.findById( id ).map( existing -> {
            boolean nameChanged = !existing.getName().equalsIgnoreCase( request.getName() );
            if ( nameChanged && sourceRepository.existsByNameIgnoreCase( request.getName() ) ) {
                throw new IllegalArgumentException( "Source name already exists" );
            }
            applyRequest( existing, request );
            return toResponse( sourceRepository.save( existing ) );
        } );
    }

    public void delete( UUID id ) {
        if ( libraryItemRepository.existsBySourceId( id ) ) {
            throw new IllegalStateException( "Cannot delete source in use" );
        }
        sourceRepository.deleteById( id );
    }

    private void applyRequest( Source source, SourceRequest request ) {
        source.setName( request.getName() );
        source.setUrl( request.getUrl() );
        source.setDescription( request.getDescription() );
    }

    private SourceResponse toResponse( Source source ) {
        return SourceResponse.builder()
                             .id( source.getId() )
                             .name( source.getName() )
                             .url( source.getUrl() )
                             .description( source.getDescription() )
                             .createdAt( toOffsetDateTime( source.getCreatedAt() ) )
                             .updatedAt( toOffsetDateTime( source.getUpdatedAt() ) )
                             .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
