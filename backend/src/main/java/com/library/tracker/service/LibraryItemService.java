package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class LibraryItemService {

    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;
    private final SourceRepository sourceRepository;
    private final UserService userService;

    public Page<LibraryItemResponse> getItems( LibraryItemFilter filter ) {
        PageRequest pageRequest = PageRequest.of( filter.page(), filter.size(), filter.sort() );
        return libraryItemRepository.findAll( buildSpecification( filter ), pageRequest )
                                    .map( this::toResponse );
    }

    public Optional<LibraryItemResponse> getById( UUID id ) {
        return libraryItemRepository.findById( id ).map( this::toResponse );
    }

    public LibraryItemResponse create( LibraryItemRequest request ) {
        LibraryItem item = new LibraryItem();
        applyRequest( item, request );
        item.setCreatedBy( userService.getCurrentUser() );
        return toResponse( libraryItemRepository.save( item ) );
    }

    public Optional<LibraryItemResponse> update( UUID id, LibraryItemRequest request ) {
        return libraryItemRepository.findById( id ).map( existing -> {
            applyRequest( existing, request );
            return toResponse( libraryItemRepository.save( existing ) );
        } );
    }

    public void delete( UUID id ) {
        libraryItemRepository.deleteById( id );
    }

    private void applyRequest( LibraryItem item, LibraryItemRequest request ) {
        item.setKind( Optional.ofNullable( request.getKind() ).orElse( MediaKind.BOOK ) );
        item.setTitle( request.getTitle() );
        item.setAltTitle( request.getAltTitle() );
        item.setComment( request.getComment() );
        item.setRating( request.getRating() );
        item.setFavorite( request.isFavorite() );
        item.setStatus( request.getStatus() );
        if ( request.getTypeId() != null ) {
            BookType type = bookTypeRepository.findById( request.getTypeId() )
                                              .orElseThrow( () -> new IllegalArgumentException( "Type not found" ) );
            item.setType( type );
        } else {
            item.setType( null );
        }
        if ( request.getSourceId() != null ) {
            item.setSource( sourceRepository.findById( request.getSourceId() )
                                            .orElseThrow( () -> new IllegalArgumentException( "Source not found" ) ) );
        } else {
            item.setSource( null );
        }
    }

    private Specification<LibraryItem> buildSpecification( LibraryItemFilter filter ) {
        return ( root, query, cb ) -> {
            Specification<LibraryItem> spec = Specification.where( null );
            if ( filter.query().isPresent() ) {
                String like = "%" + filter.query().get().toLowerCase() + "%";
                spec = spec.and( ( r, q, c ) -> c.or(
                        c.like( c.lower( r.get( "title" ) ), like ),
                        c.like( c.lower( r.get( "altTitle" ) ), like ) ) );
            }
            if ( filter.typeId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "type" ).get( "id" ), filter.typeId().get() ) );
            }
            if ( filter.status().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.get( "status" ), filter.status().get() ) );
            }
            if ( filter.favorite().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.get( "favorite" ), filter.favorite().get() ) );
            }
            if ( filter.minRating().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.ge( r.get( "rating" ), filter.minRating().get() ) );
            }
            if ( filter.maxRating().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.le( r.get( "rating" ), filter.maxRating().get() ) );
            }
            if ( filter.createdFrom().isPresent() ) {
                LocalDateTime from = toLocalDateTime( filter.createdFrom().get() );
                spec = spec.and( ( r, q, c ) -> c.greaterThanOrEqualTo( r.get( "createdAt" ), from ) );
            }
            if ( filter.createdTo().isPresent() ) {
                LocalDateTime to = toLocalDateTime( filter.createdTo().get() );
                spec = spec.and( ( r, q, c ) -> c.lessThanOrEqualTo( r.get( "createdAt" ), to ) );
            }
            if ( filter.updatedFrom().isPresent() ) {
                LocalDateTime from = toLocalDateTime( filter.updatedFrom().get() );
                spec = spec.and( ( r, q, c ) -> c.greaterThanOrEqualTo( r.get( "updatedAt" ), from ) );
            }
            if ( filter.updatedTo().isPresent() ) {
                LocalDateTime to = toLocalDateTime( filter.updatedTo().get() );
                spec = spec.and( ( r, q, c ) -> c.lessThanOrEqualTo( r.get( "updatedAt" ), to ) );
            }
            if ( filter.kind().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.get( "kind" ), filter.kind().get() ) );
            }
            return spec.toPredicate( root, query, cb );
        };
    }

    private LibraryItemResponse toResponse( LibraryItem item ) {
        return LibraryItemResponse.builder()
                                  .id( item.getId() )
                                  .kind( item.getKind() )
                                  .title( item.getTitle() )
                                  .altTitle( item.getAltTitle() )
                                  .typeId( item.getType() != null ? item.getType().getId() : null )
                                  .typeName( item.getType() != null ? item.getType().getName() : null )
                                  .sourceId( item.getSource() != null ? item.getSource().getId() : null )
                                  .sourceName( item.getSource() != null ? item.getSource().getName() : null )
                                  .sourceUrl( item.getSource() != null ? item.getSource().getUrl() : null )
                                  .createdById( item.getCreatedBy() != null ? item.getCreatedBy().getId() : null )
                                  .createdByUsername(
                                          item.getCreatedBy() != null ? item.getCreatedBy().getUsername() : null )
                                  .comment( item.getComment() )
                                  .rating( item.getRating() )
                                  .favorite( item.isFavorite() )
                                  .status( item.getStatus() )
                                  .createdAt( toOffsetDateTime( item.getCreatedAt() ) )
                                  .updatedAt( toOffsetDateTime( item.getUpdatedAt() ) )
                                  .build();
    }

    private LocalDateTime toLocalDateTime( OffsetDateTime dateTime ) {
        return dateTime != null ? dateTime.toLocalDateTime() : null;
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
