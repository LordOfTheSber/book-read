package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.storage.ObjectStorage;
import com.library.tracker.storage.StoredObject;
import com.library.tracker.web.dto.AuthorSummary;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;
import com.library.tracker.web.dto.ProgressResponse;
import com.library.tracker.web.dto.SourceCountResponse;
import com.library.tracker.web.dto.TypeCountResponse;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Transactional
public class LibraryItemService {

    /** Обложка не должна раздувать ни БД, ни трафик выборки списка. */
    private static final long MAX_COVER_BYTES = 5L * 1024 * 1024;

    private static final Set<String> ALLOWED_COVER_TYPES =
            Set.of( "image/png", "image/jpeg", "image/jpg", "image/webp" );

    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;
    private final SourceRepository sourceRepository;
    private final AuthorService authorService;
    private final SeriesService seriesService;
    private final ObjectStorage objectStorage;
    private final ReadingProgressService readingProgressService;
    private final ReadingLogRepository readingLogRepository;
    private final Clock clock;
    private final UserService userService;

    public Page<LibraryItemResponse> getItems( LibraryItemFilter filter ) {
        PageRequest pageRequest = PageRequest.of( filter.page(), filter.size(), filter.sort() );
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );
        Page<LibraryItem> page =
                libraryItemRepository.findAll( buildSpecification( filter, currentUser, isAdmin ), pageRequest );

        // Авторы — коллекция, и в графе страницы их нет: забираем одним запросом на всю страницу.
        Map<UUID, List<AuthorSummary>> authorsByItem = loadAuthors( page.getContent() );
        return page.map( item -> toResponse( item, authorsByItem.get( item.getId() ) ) );
    }

    private Map<UUID, List<AuthorSummary>> loadAuthors( List<LibraryItem> items ) {
        if ( items.isEmpty() ) {
            return Map.of();
        }
        List<UUID> ids = items.stream().map( LibraryItem::getId ).toList();
        return libraryItemRepository.findAuthorsByItemIds( ids ).stream()
                                    .collect( Collectors.groupingBy(
                                            LibraryItemRepository.ItemAuthorRow::getItemId,
                                            Collectors.mapping( row -> AuthorSummary.builder()
                                                                                    .id( row.getAuthorId() )
                                                                                    .name( row.getName() )
                                                                                    .altName( row.getAltName() )
                                                                                    .build(),
                                                                Collectors.toList() ) ) );
    }

    public Optional<LibraryItemResponse> getById( UUID id ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );
        return libraryItemRepository.findWithRelationsById( id )
                                    .filter( item -> isAdmin || isOwnedBy( item, currentUser ) )
                                    .map( this::toResponse );
    }

    public LibraryItemResponse create( LibraryItemRequest request ) {
        LibraryItem item = new LibraryItem();
        applyRequest( item, request );
        item.setCreatedBy( userService.getCurrentUser() );
        LibraryItem saved = libraryItemRepository.save( item );
        // Книгу можно завести сразу в статусе «читаю»: тогда проход открывается тут же.
        readingProgressService.applyStatusTransition( saved, null, LocalDate.now( clock ) );
        return toResponse( libraryItemRepository.save( saved ) );
    }

    public Optional<LibraryItemResponse> update( UUID id, LibraryItemRequest request ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        return libraryItemRepository.findWithRelationsById( id ).map( existing -> {
            if ( !isAdmin && !isOwnedBy( existing, currentUser ) ) {
                throw new AccessDeniedException( "Вы можете редактировать только свои книги" );
            }
            ReadingStatus previousStatus = existing.getStatus();
            applyRequest( existing, request );
            // Даты начала и завершения ведёт сама смена статуса — вручную их проставлять не нужно.
            readingProgressService.applyStatusTransition( existing, previousStatus, LocalDate.now( clock ) );
            return toResponse( libraryItemRepository.save( existing ) );
        } );
    }

    public void delete( UUID id ) {
        LibraryItem item = requireWritable( id, "Вы можете удалять только свои книги" );

        // Обложка живёт вне БД, поэтому за ней нужно сходить отдельно — иначе останется сиротой.
        if ( item.getCoverKey() != null ) {
            objectStorage.delete( item.getCoverKey() );
        }
        libraryItemRepository.deleteById( id );
    }

    /**
     * Заменяет обложку. Ключ детерминированный, поэтому повторная загрузка перезаписывает объект,
     * не оставляя мусора в хранилище.
     */
    public LibraryItemResponse updateCover( UUID id, MultipartFile file ) {
        LibraryItem item = requireWritable( id, "Вы можете менять только свои книги" );
        validateCover( file );

        String key = coverKey( id );
        try {
            objectStorage.put( key, file.getBytes(), file.getContentType() );
        } catch ( IOException ex ) {
            throw new IllegalArgumentException( "Не удалось прочитать файл обложки" );
        }
        item.setCoverKey( key );
        item.setCoverContentType( file.getContentType() );
        return toResponse( libraryItemRepository.save( item ) );
    }

    @Transactional( readOnly = true )
    public Optional<StoredObject> getCover( UUID id ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        return libraryItemRepository.findById( id )
                                    .filter( item -> isAdmin || isOwnedBy( item, currentUser ) )
                                    .filter( item -> item.getCoverKey() != null )
                                    .flatMap( item -> objectStorage.get( item.getCoverKey() )
                                                                   .map( stored -> withContentType( stored, item ) ) );
    }

    public LibraryItemResponse deleteCover( UUID id ) {
        LibraryItem item = requireWritable( id, "Вы можете менять только свои книги" );
        if ( item.getCoverKey() != null ) {
            objectStorage.delete( item.getCoverKey() );
            item.setCoverKey( null );
            item.setCoverContentType( null );
        }
        return toResponse( libraryItemRepository.save( item ) );
    }

    /** Находит запись и проверяет право её менять — иначе каждый метод повторял бы одно и то же. */
    private LibraryItem requireWritable( UUID id, String denialMessage ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        LibraryItem item = libraryItemRepository.findWithRelationsById( id )
                .orElseThrow( () -> new IllegalArgumentException( "Книга не найдена" ) );

        if ( !isAdmin && !isOwnedBy( item, currentUser ) ) {
            throw new AccessDeniedException( denialMessage );
        }
        return item;
    }

    private void validateCover( MultipartFile file ) {
        if ( file == null || file.isEmpty() ) {
            throw new IllegalArgumentException( "Файл обложки пуст" );
        }
        if ( file.getSize() > MAX_COVER_BYTES ) {
            throw new IllegalArgumentException( "Обложка должна быть меньше 5 МБ" );
        }
        String contentType = file.getContentType();
        if ( contentType == null || !ALLOWED_COVER_TYPES.contains( contentType.toLowerCase() ) ) {
            throw new IllegalArgumentException( "Неподдерживаемый формат обложки. Допустимы PNG, JPEG, WEBP" );
        }
    }

    private String coverKey( UUID id ) {
        return "covers/" + id;
    }

    /** Файловое хранилище тип может и не вернуть — тогда берём сохранённый в карточке. */
    private StoredObject withContentType( StoredObject stored, LibraryItem item ) {
        return stored.contentType() != null
                ? stored
                : new StoredObject( stored.content(), item.getCoverContentType() );
    }

    @Transactional( readOnly = true )
    public BookAnalyticsResponse getAnalytics( Optional<UUID> userId ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        if ( userId.isPresent() && !isAdmin && !userId.get().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Недостаточно прав для просмотра аналитики другого пользователя" );
        }

        UUID targetUserId = userId.filter( id -> isAdmin || id.equals( currentUser.getId() ) )
                                  .orElseGet( () -> isAdmin ? null : currentUser.getId() );

        long totalItems = libraryItemRepository.countAllByUserId( targetUserId );
        long favoriteItems = libraryItemRepository.countFavorites( targetUserId );
        Double avg = libraryItemRepository.averageRating( targetUserId );

        var statusBreakdown = libraryItemRepository.countByStatus( targetUserId )
                                                   .stream()
                                                   .collect( Collectors.toMap(
                                                           LibraryItemRepository.StatusCount::getStatus,
                                                           LibraryItemRepository.StatusCount::getCount ) );

        var topTypes = libraryItemRepository.countByType( targetUserId )
                                            .stream()
                                            .map( tc -> TypeCountResponse.builder()
                                                                         .typeId( tc.getTypeId() )
                                                                         .typeName( tc.getTypeName() )
                                                                         .count( tc.getCount() )
                                                                         .build() )
                                            .toList();

        var topSources = libraryItemRepository.countBySource( targetUserId )
                                              .stream()
                                              .map( sc -> SourceCountResponse.builder()
                                                                             .sourceId( sc.getSourceId() )
                                                                             .sourceName( sc.getSourceName() )
                                                                             .count( sc.getCount() )
                                                                             .build() )
                                              .toList();

        return BookAnalyticsResponse.builder()
                                    .totalItems( totalItems )
                                    .favoriteItems( favoriteItems )
                                    .averageRating( avg != null ? BigDecimal.valueOf( avg ) : null )
                                    .statusBreakdown( statusBreakdown )
                                    .topTypes( topTypes )
                                    .topSources( topSources )
                                    .build();
    }

    private void applyRequest( LibraryItem item, LibraryItemRequest request ) {
        item.setKind( Optional.ofNullable( request.getKind() ).orElse( MediaKind.BOOK ) );
        item.setTitle( request.getTitle() );
        item.setAltTitle( request.getAltTitle() );
        item.setAuthors( new LinkedHashSet<>( authorService.resolveByNames( request.getAuthorNames() ) ) );
        item.setSeries( seriesService.resolveByName( request.getSeriesName() ).orElse( null ) );
        // Номер без серии смысла не имеет и только путал бы сортировку по циклу.
        item.setOrderInSeries( item.getSeries() != null ? request.getOrderInSeries() : null );
        item.setIsbn( trimToNull( request.getIsbn() ) );
        item.setPublishedYear( request.getPublishedYear() );
        item.setLanguage( trimToNull( request.getLanguage() ) );
        item.setPageCount( request.getPageCount() );
        item.setTranslator( trimToNull( request.getTranslator() ) );
        item.setFormat( request.getFormat() );
        item.setStartedAt( request.getStartedAt() );
        item.setFinishedAt( request.getFinishedAt() );
        item.setDeadline( request.getDeadline() );
        item.setProgressCurrent( request.getProgressCurrent() );
        item.setProgressTotal( request.getProgressTotal() );
        item.setProgressUnit( request.getProgressUnit() );
        item.setBookcase( trimToNull( request.getBookcase() ) );
        item.setShelf( trimToNull( request.getShelf() ) );
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

    private boolean isOwnedBy( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && item.getCreatedBy().getId().equals( user.getId() );
    }

    private Specification<LibraryItem> buildSpecification( LibraryItemFilter filter, User currentUser, boolean isAdmin ) {
        return ( root, query, cb ) -> {
            Specification<LibraryItem> spec = Specification.where( null );
            if ( filter.userId().isPresent() && !isAdmin && !filter.userId().get().equals( currentUser.getId() ) ) {
                throw new AccessDeniedException( "Недостаточно прав для просмотра книг другого пользователя" );
            }
            if ( filter.query().isPresent() ) {
                String like = "%" + filter.query().get().toLowerCase() + "%";
                // Поиск заодно идёт по автору: искать книгу по фамилии — первое, чего от него ждут.
                spec = spec.and( ( r, q, c ) -> {
                    if ( q != null ) {
                        q.distinct( true );
                    }
                    return c.or(
                            c.like( c.lower( r.get( "title" ) ), like ),
                            c.like( c.lower( r.get( "altTitle" ) ), like ),
                            c.like( c.lower( r.join( "authors", jakarta.persistence.criteria.JoinType.LEFT )
                                              .get( "name" ) ), like ) );
                } );
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
            if ( filter.finishedFrom().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.greaterThanOrEqualTo( r.get( "finishedAt" ),
                                                                        filter.finishedFrom().get() ) );
            }
            if ( filter.finishedTo().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.lessThanOrEqualTo( r.get( "finishedAt" ),
                                                                     filter.finishedTo().get() ) );
            }
            if ( filter.authorId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "authors" ).get( "id" ), filter.authorId().get() ) );
            }
            if ( filter.seriesId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "series" ).get( "id" ), filter.seriesId().get() ) );
            }
            if ( filter.userId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "createdBy" ).get( "id" ), filter.userId().get() ) );
            } else if ( !isAdmin ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "createdBy" ).get( "id" ), currentUser.getId() ) );
            }
            return spec.toPredicate( root, query, cb );
        };
    }

    private LibraryItemResponse toResponse( LibraryItem item ) {
        return toResponse( item, authorsOf( item ) );
    }

    /** Авторы из самой сущности: годится там, где она загружена вместе с ними. */
    private List<AuthorSummary> authorsOf( LibraryItem item ) {
        return item.getAuthors().stream()
                   .sorted( Comparator.comparing( Author::getName, String.CASE_INSENSITIVE_ORDER ) )
                   .map( author -> AuthorSummary.builder()
                                                .id( author.getId() )
                                                .name( author.getName() )
                                                .altName( author.getAltName() )
                                                .build() )
                   .toList();
    }

    private LibraryItemResponse toResponse( LibraryItem item, List<AuthorSummary> authors ) {
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
                                  .authors( authors != null ? authors : List.of() )
                                  .seriesId( item.getSeries() != null ? item.getSeries().getId() : null )
                                  .seriesName( item.getSeries() != null ? item.getSeries().getName() : null )
                                  .orderInSeries( item.getOrderInSeries() )
                                  .isbn( item.getIsbn() )
                                  .publishedYear( item.getPublishedYear() )
                                  .language( item.getLanguage() )
                                  .pageCount( item.getPageCount() )
                                  .translator( item.getTranslator() )
                                  .format( item.getFormat() )
                                  .bookcase( item.getBookcase() )
                                  .shelf( item.getShelf() )
                                  .hasCover( item.getCoverKey() != null )
                                  .startedAt( item.getStartedAt() )
                                  .finishedAt( item.getFinishedAt() )
                                  .deadline( item.getDeadline() )
                                  .progress( progressOf( item ) )
                                  .attempt( attemptOf( item ) )
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

    private ProgressResponse progressOf( LibraryItem item ) {
        return readingProgressService.toProgress( item, LocalDate.now( clock ) );
    }

    /** Номер текущего прохода: без записей это первый, со второго — перечитывание. */
    private int attemptOf( LibraryItem item ) {
        if ( item.getId() == null ) {
            return 1;
        }
        return readingLogRepository.findFirstByItemIdOrderByAttemptDesc( item.getId() )
                                   .map( log -> log.getAttempt() )
                                   .orElse( 1 );
    }

    private String trimToNull( String value ) {
        return StringUtils.hasText( value ) ? value.trim() : null;
    }

    private LocalDateTime toLocalDateTime( OffsetDateTime dateTime ) {
        return dateTime != null ? dateTime.toLocalDateTime() : null;
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
