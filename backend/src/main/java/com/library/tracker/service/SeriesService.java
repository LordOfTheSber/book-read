package com.library.tracker.service;

import com.library.tracker.domain.Series;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SeriesRepository;
import com.library.tracker.web.dto.SeriesRequest;
import com.library.tracker.web.dto.SeriesResponse;
import com.library.tracker.web.dto.ShowcaseItemResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;
    private final ShowcaseAssembler showcaseAssembler;

    @Transactional( readOnly = true )
    public List<SeriesResponse> findAll() {
        Map<UUID, LibraryItemRepository.SeriesCount> counts = counts();
        return seriesRepository.findAllByOrderByNameAsc().stream()
                               .map( series -> toResponse( series, counts ) )
                               .toList();
    }

    /**
     * Обложки для показанных карточек цикла — в порядке томов: карточка серии тем и полезна,
     * что видно, на чём цикл встал.
     */
    @Transactional( readOnly = true )
    public Map<UUID, List<ShowcaseItemResponse>> showcase( Collection<UUID> seriesIds ) {
        return showcaseAssembler.assemble( seriesIds, libraryItemRepository::findShowcaseBySeries );
    }

    @Transactional( readOnly = true )
    public Optional<SeriesResponse> findById( UUID id ) {
        Map<UUID, LibraryItemRepository.SeriesCount> counts = counts();
        return seriesRepository.findById( id ).map( series -> toResponse( series, counts ) );
    }

    public SeriesResponse create( SeriesRequest request ) {
        if ( seriesRepository.existsByNameIgnoreCase( request.getName().trim() ) ) {
            throw new IllegalArgumentException( "Series name already exists" );
        }
        Series series = new Series();
        applyRequest( series, request );
        return toResponse( seriesRepository.save( series ), counts() );
    }

    public Optional<SeriesResponse> update( UUID id, SeriesRequest request ) {
        return seriesRepository.findById( id ).map( existing -> {
            boolean nameChanged = !existing.getName().equalsIgnoreCase( request.getName().trim() );
            if ( nameChanged && seriesRepository.existsByNameIgnoreCase( request.getName().trim() ) ) {
                throw new IllegalArgumentException( "Series name already exists" );
            }
            applyRequest( existing, request );
            return toResponse( seriesRepository.save( existing ), counts() );
        } );
    }

    public void delete( UUID id ) {
        if ( libraryItemRepository.existsBySeriesId( id ) ) {
            throw new IllegalStateException( "Cannot delete series in use" );
        }
        seriesRepository.deleteById( id );
    }

    /** Как и у авторов: карточка присылает название, а не идентификатор. */
    public Optional<Series> resolveByName( String name ) {
        if ( !StringUtils.hasText( name ) ) {
            return Optional.empty();
        }
        String trimmed = name.trim();
        return Optional.of( seriesRepository.findByNameIgnoreCase( trimmed ).orElseGet( () -> {
            Series series = new Series();
            series.setName( trimmed );
            return seriesRepository.save( series );
        } ) );
    }

    private Map<UUID, LibraryItemRepository.SeriesCount> counts() {
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();
        return libraryItemRepository.countBySeries( scope ).stream()
                                    .collect( Collectors.toMap( LibraryItemRepository.SeriesCount::getSeriesId,
                                                                Function.identity() ) );
    }

    private void applyRequest( Series series, SeriesRequest request ) {
        series.setName( request.getName().trim() );
        series.setDescription( StringUtils.hasText( request.getDescription() )
                                       ? request.getDescription().trim()
                                       : null );
    }

    private SeriesResponse toResponse( Series series, Map<UUID, LibraryItemRepository.SeriesCount> counts ) {
        LibraryItemRepository.SeriesCount count = counts.get( series.getId() );
        return SeriesResponse.builder()
                             .id( series.getId() )
                             .name( series.getName() )
                             .description( series.getDescription() )
                             .itemCount( count != null ? count.getCount() : 0 )
                             .completedCount( count != null ? count.getCompletedCount() : 0 )
                             .createdAt( toOffsetDateTime( series.getCreatedAt() ) )
                             .updatedAt( toOffsetDateTime( series.getUpdatedAt() ) )
                             .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
