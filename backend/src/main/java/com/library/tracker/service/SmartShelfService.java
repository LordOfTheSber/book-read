package com.library.tracker.service;

import com.library.tracker.domain.SavedFilter;
import com.library.tracker.domain.SmartShelf;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SmartShelfRepository;
import com.library.tracker.web.dto.SmartShelfRequest;
import com.library.tracker.web.dto.SmartShelfResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Умные полки: сохранённый фильтр как объект. Фильтр выдачи уже принимал десяток параметров —
 * не хватало только возможности назвать удачную комбинацию и вернуться к ней завтра.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SmartShelfService {

    private final SmartShelfRepository smartShelfRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<SmartShelfResponse> findAll() {
        User currentUser = userService.getCurrentUser();
        return smartShelfRepository.findByOwnerIdOrderByNameAsc( currentUser.getId() ).stream()
                                   .map( this::toResponse )
                                   .toList();
    }

    public SmartShelfResponse create( SmartShelfRequest request ) {
        User currentUser = userService.getCurrentUser();
        String name = request.getName().trim();
        if ( smartShelfRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
            throw new IllegalArgumentException( "Умная полка с таким названием уже есть" );
        }
        SmartShelf shelf = new SmartShelf();
        shelf.setOwner( currentUser );
        applyRequest( shelf, request );
        return toResponse( smartShelfRepository.save( shelf ) );
    }

    public Optional<SmartShelfResponse> update( UUID id, SmartShelfRequest request ) {
        User currentUser = userService.getCurrentUser();
        return smartShelfRepository.findById( id ).map( shelf -> {
            requireOwner( shelf, currentUser );
            String name = request.getName().trim();
            if ( !shelf.getName().equalsIgnoreCase( name )
                 && smartShelfRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
                throw new IllegalArgumentException( "Умная полка с таким названием уже есть" );
            }
            applyRequest( shelf, request );
            return toResponse( smartShelfRepository.save( shelf ) );
        } );
    }

    public void delete( UUID id ) {
        User currentUser = userService.getCurrentUser();
        smartShelfRepository.findById( id ).ifPresent( shelf -> {
            requireOwner( shelf, currentUser );
            smartShelfRepository.delete( shelf );
        } );
    }

    private void requireOwner( SmartShelf shelf, User currentUser ) {
        if ( shelf.getOwner() == null || !shelf.getOwner().getId().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Вы можете править только свои полки" );
        }
    }

    private void applyRequest( SmartShelf shelf, SmartShelfRequest request ) {
        shelf.setName( request.getName().trim() );
        shelf.setDescription( StringUtils.hasText( request.getDescription() )
                                      ? request.getDescription().trim()
                                      : null );
        shelf.setFilter( request.getFilter() != null ? request.getFilter() : new SavedFilter() );
    }

    private SmartShelfResponse toResponse( SmartShelf shelf ) {
        return SmartShelfResponse.builder()
                                 .id( shelf.getId() )
                                 .name( shelf.getName() )
                                 .description( shelf.getDescription() )
                                 .filter( shelf.getFilter() )
                                 .createdAt( toOffsetDateTime( shelf.getCreatedAt() ) )
                                 .updatedAt( toOffsetDateTime( shelf.getUpdatedAt() ) )
                                 .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
