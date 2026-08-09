package com.library.tracker.service;

import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.Author;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.service.engagement.AchievementService;
import com.library.tracker.service.metadata.CoverDownloadService;
import com.library.tracker.service.social.ActivityService;
import com.library.tracker.storage.ObjectStorage;
import com.library.tracker.storage.StoredObject;
import com.library.tracker.web.dto.AuthorSummary;
import com.library.tracker.web.dto.BookAnalyticsResponse;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;
import com.library.tracker.web.dto.ProgressResponse;
import com.library.tracker.web.dto.ShelfSummary;
import com.library.tracker.web.dto.SourceCountResponse;
import com.library.tracker.web.dto.TagSummary;
import com.library.tracker.web.dto.TypeCountResponse;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

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
    private final TagRepository tagRepository;
    private final ShelfRepository shelfRepository;
    private final AuthorService authorService;
    private final TagService tagService;
    private final SeriesService seriesService;
    private final ObjectStorage objectStorage;
    private final CoverDownloadService coverDownloadService;
    private final ReadingProgressService readingProgressService;
    private final ReadingLogRepository readingLogRepository;
    private final Clock clock;
    private final UserService userService;
    private final ActivityService activityService;
    private final AchievementService achievementService;

    public Page<LibraryItemResponse> getItems( LibraryItemFilter filter ) {
        PageRequest pageRequest = PageRequest.of( filter.page(), filter.size(), filter.sort() );
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );
        Page<LibraryItem> page =
                libraryItemRepository.findAll( buildSpecification( filter, currentUser, isAdmin ), pageRequest );

        // Авторы и теги — коллекции, и в графе страницы их нет: забираем по одному запросу
        // на всю страницу, а не по запросу на строку.
        Map<UUID, List<AuthorSummary>> authorsByItem = loadAuthors( page.getContent() );
        Map<UUID, List<TagSummary>> tagsByItem = loadTags( page.getContent() );
        Map<UUID, List<ShelfSummary>> shelvesByItem = loadShelves( page.getContent(), currentUser.getId() );
        return page.map( item -> toResponse( item, authorsByItem.get( item.getId() ),
                                             tagsByItem.get( item.getId() ),
                                             shelvesByItem.get( item.getId() ) ) );
    }

    private Map<UUID, List<ShelfSummary>> loadShelves( List<LibraryItem> items, UUID ownerId ) {
        if ( items.isEmpty() ) {
            return Map.of();
        }
        List<UUID> ids = items.stream().map( LibraryItem::getId ).toList();
        return shelfRepository.findShelvesByItemIds( ids, ownerId ).stream()
                              .collect( Collectors.groupingBy(
                                      ShelfRepository.ItemShelfRow::getItemId,
                                      Collectors.mapping( row -> ShelfSummary.builder()
                                                                             .id( row.getShelfId() )
                                                                             .name( row.getName() )
                                                                             .build(),
                                                          Collectors.toList() ) ) );
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

    private Map<UUID, List<TagSummary>> loadTags( List<LibraryItem> items ) {
        if ( items.isEmpty() ) {
            return Map.of();
        }
        List<UUID> ids = items.stream().map( LibraryItem::getId ).toList();
        return tagRepository.findTagsByItemIds( ids ).stream()
                            .collect( Collectors.groupingBy(
                                    TagRepository.ItemTagRow::getItemId,
                                    Collectors.mapping( row -> TagSummary.builder()
                                                                         .id( row.getTagId() )
                                                                         .name( row.getName() )
                                                                         .color( row.getColor() )
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
        // Владелец проставляется до разбора запроса: теги личные, и без него их некуда завести.
        item.setCreatedBy( userService.getCurrentUser() );
        applyRequest( item, request );
        LibraryItem saved = libraryItemRepository.save( item );
        // Состав полки задаётся со стороны полки, поэтому только после появления идентификатора.
        applyShelves( saved, request.getShelfIds() );
        // Книгу можно завести сразу в статусе «читаю»: тогда проход открывается тут же.
        readingProgressService.applyStatusTransition( saved, null, LocalDate.now( clock ) );
        LibraryItem stored = libraryItemRepository.save( saved );
        recordActivity( stored, null, null );
        return toResponse( stored );
    }

    public Optional<LibraryItemResponse> update( UUID id, LibraryItemRequest request ) {
        User currentUser = userService.getCurrentUser();
        boolean isAdmin = userService.isAdmin( currentUser );

        return libraryItemRepository.findWithRelationsById( id ).map( existing -> {
            if ( !isAdmin && !isOwnedBy( existing, currentUser ) ) {
                throw new AccessDeniedException( "Вы можете редактировать только свои книги" );
            }
            ReadingStatus previousStatus = existing.getStatus();
            BigDecimal previousRating = existing.getRating();
            String previousReview = existing.getReview();
            applyRequest( existing, request );
            applyShelves( existing, request.getShelfIds() );
            // Даты начала и завершения ведёт сама смена статуса — вручную их проставлять не нужно.
            readingProgressService.applyStatusTransition( existing, previousStatus, LocalDate.now( clock ) );
            LibraryItem stored = libraryItemRepository.save( existing );
            recordActivity( stored, previousStatus, previousReview, previousRating );
            return toResponse( stored );
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

    /**
     * Обложка из внешнего каталога. Скачивает сервер: у каталогов нет CORS-заголовков, поэтому
     * браузер до картинки не дотянется, а ссылка проверяется по списку разрешённых хостов.
     */
    public LibraryItemResponse updateCoverFromUrl( UUID id, String url ) {
        LibraryItem item = requireWritable( id, "Вы можете менять только свои книги" );
        CoverDownloadService.Downloaded downloaded = coverDownloadService.download( url );

        String key = coverKey( id );
        objectStorage.put( key, downloaded.content(), downloaded.contentType() );
        item.setCoverKey( key );
        item.setCoverContentType( downloaded.contentType() );
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

    private void recordActivity( LibraryItem item, ReadingStatus previousStatus, String previousReview ) {
        recordActivity( item, previousStatus, previousReview, null );
    }

    /**
     * Что из правки карточки попадает в ленту. Событий намеренно немного: лента, куда сыплется
     * каждое изменение поля, читается как журнал ошибок, и её перестают открывать.
     * <p>
     * Владелец записи, а не правящий: администратор, поправивший чужую карточку, не должен
     * оказаться в ленте так, будто он это прочитал.
     */
    private void recordActivity( LibraryItem item,
                                 ReadingStatus previousStatus,
                                 String previousReview,
                                 BigDecimal previousRating ) {
        User owner = item.getCreatedBy();
        if ( owner == null ) {
            return;
        }

        if ( item.getStatus() != previousStatus ) {
            if ( item.getStatus() == ReadingStatus.READING ) {
                activityService.record( owner, ActivityType.STARTED_READING, item, null, item.getTitle(), null );
            } else if ( item.getStatus() == ReadingStatus.COMPLETED ) {
                activityService.record( owner, ActivityType.FINISHED_READING, item, null, item.getTitle(),
                                        item.getRating() != null ? item.getRating().toPlainString() : null );
                // Достижения пересчитываются здесь же: половина из них завязана на завершённые,
                // и ждать до открытия страницы значило бы выдавать их с опозданием.
                achievementService.evaluate( owner );
            }
        }

        boolean reviewAppeared = StringUtils.hasText( item.getReview() )
                                 && !item.getReview().equals( previousReview );
        if ( reviewAppeared ) {
            activityService.record( owner, ActivityType.PUBLISHED_REVIEW, item, null, item.getTitle(), null );
        }

        // Первая оценка — тоже событие: условие «прежняя не пуста» молча пропускало бы её,
        // а именно она и есть тот случай, когда человеку есть что сказать.
        boolean ratingChanged = item.getRating() != null
                                && ( previousRating == null || item.getRating().compareTo( previousRating ) != 0 );
        // Оценка при завершении уже уехала в событие «дочитал» — второй раз о ней не сообщаем.
        if ( ratingChanged && item.getStatus() == previousStatus ) {
            activityService.record( owner, ActivityType.RATED, item, null, item.getTitle(),
                                    item.getRating().toPlainString() );
        }
    }

    private void applyRequest( LibraryItem item, LibraryItemRequest request ) {
        item.setKind( Optional.ofNullable( request.getKind() ).orElse( MediaKind.BOOK ) );
        item.setTitle( request.getTitle() );
        item.setAltTitle( request.getAltTitle() );
        item.setAuthors( new LinkedHashSet<>( authorService.resolveByNames( request.getAuthorNames() ) ) );
        // Теги личные, поэтому заводятся владельцу записи, а не тому, кто её правит:
        // администратор, поправивший чужую карточку, не должен забирать её теги себе.
        item.setTags( new LinkedHashSet<>( tagService.resolveByNames( request.getTagNames(), tagOwner( item ) ) ) );
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
        item.setNote( request.getNote() );
        item.setReview( request.getReview() );
        item.setReviewSpoiler( request.getReviewSpoiler() );
        item.setRatingPlot( request.getRatingPlot() );
        item.setRatingStyle( request.getRatingStyle() );
        item.setRatingCharacters( request.getRatingCharacters() );
        item.setRatingEnding( request.getRatingEnding() );
        item.setRating( request.getRating() );
        item.setFavorite( request.isFavorite() );
        item.setWishlist( request.isWishlist() );
        item.setPrice( request.getPrice() );
        item.setCurrency( trimToNull( request.getCurrency() ) );
        item.setPurchaseUrl( trimToNull( request.getPurchaseUrl() ) );
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
                /*
                 * Поиск идёт по названию, автору, тегам и выпискам: книгу ищут по фамилии,
                 * по собственной пометке и по запомнившейся фразе примерно одинаково часто.
                 * Форма условия — `lower(поле) like '%…%'` — выбрана под индексы pg_trgm из V14:
                 * прежний поиск по двум полям не мог опереться ни на один из них.
                 */
                spec = spec.and( ( r, q, c ) -> {
                    if ( q != null ) {
                        q.distinct( true );
                    }
                    List<Predicate> matches = new java.util.ArrayList<>( List.of(
                            c.like( c.lower( r.get( "title" ) ), like ),
                            c.like( c.lower( r.get( "altTitle" ) ), like ),
                            c.like( c.lower( r.join( "authors", JoinType.LEFT ).get( "name" ) ), like ),
                            c.like( c.lower( r.join( "tags", JoinType.LEFT ).get( "name" ) ), like ) ) );
                    if ( q != null ) {
                        // Выписки лежат отдельной таблицей и в join не годятся: их у книги десятки,
                        // и выдача размножилась бы по числу совпавших цитат.
                        Subquery<UUID> quoted = q.subquery( UUID.class );
                        Root<Quote> quote = quoted.from( Quote.class );
                        quoted.select( quote.get( "item" ).get( "id" ) )
                              .where( c.or( c.like( c.lower( quote.get( "text" ) ), like ),
                                            c.like( c.lower( quote.get( "note" ) ), like ) ) );
                        matches.add( r.get( "id" ).in( quoted ) );
                    }
                    return c.or( matches.toArray( Predicate[]::new ) );
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
            if ( filter.tagId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "tags" ).get( "id" ), filter.tagId().get() ) );
            }
            if ( filter.shelfId().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.join( "shelves" ).get( "id" ), filter.shelfId().get() ) );
            }
            if ( filter.wishlist().isPresent() ) {
                spec = spec.and( ( r, q, c ) -> c.equal( r.get( "wishlist" ), filter.wishlist().get() ) );
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
        return toResponse( item, authorsOf( item ), tagsOf( item ), shelvesOf( item ) );
    }

    /** Теги из самой сущности: одиночная выдача не пагинируется, лишний select тут не страшен. */
    private List<TagSummary> tagsOf( LibraryItem item ) {
        return item.getTags().stream()
                   .sorted( Comparator.comparing( Tag::getName, String.CASE_INSENSITIVE_ORDER ) )
                   .map( tag -> TagSummary.builder()
                                          .id( tag.getId() )
                                          .name( tag.getName() )
                                          .color( tag.getColor() )
                                          .build() )
                   .toList();
    }

    /**
     * Приводит состав полок к присланному списку. Владелец связи — полка, а не запись
     * ({@code mappedBy}), поэтому писать приходится с той стороны: правка {@code item.shelves}
     * не доехала бы до join-таблицы вовсе.
     * <p>
     * Трогаются только полки владельца записи и только те, у которых членство меняется:
     * положить книгу на чужую полку — это доступ к чужим данным через боковую дверь.
     */
    private void applyShelves( LibraryItem item, List<UUID> shelfIds ) {
        if ( shelfIds == null ) {
            // Поле не прислали — карточку можно сохранить, ничего не зная о полках.
            return;
        }
        UUID ownerId = tagOwner( item ).getId();
        Set<UUID> desired = shelfIds.stream()
                                    .filter( java.util.Objects::nonNull )
                                    .collect( Collectors.toCollection( LinkedHashSet::new ) );
        Set<UUID> current = item.getShelves().stream()
                                .filter( shelf -> shelf.getOwner() != null
                                                  && shelf.getOwner().getId().equals( ownerId ) )
                                .map( Shelf::getId )
                                .collect( Collectors.toCollection( LinkedHashSet::new ) );

        desired.stream().filter( id -> !current.contains( id ) )
               .forEach( id -> updateShelfMembership( id, ownerId, item, true ) );
        current.stream().filter( id -> !desired.contains( id ) )
               .forEach( id -> updateShelfMembership( id, ownerId, item, false ) );
    }

    private void updateShelfMembership( UUID shelfId, UUID ownerId, LibraryItem item, boolean add ) {
        shelfRepository.findWithItemsById( shelfId )
                       .filter( shelf -> shelf.getOwner() != null && shelf.getOwner().getId().equals( ownerId ) )
                       .ifPresent( shelf -> {
                           if ( add ) {
                               shelf.getItems().add( item );
                           } else {
                               shelf.getItems().remove( item );
                           }
                           shelfRepository.save( shelf );
                       } );
    }

    /** Полки из самой сущности — только свои: чужие полки с этой записью спрашивающего не касаются. */
    private List<ShelfSummary> shelvesOf( LibraryItem item ) {
        UUID currentUserId = userService.getCurrentUser().getId();
        return item.getShelves().stream()
                   .filter( shelf -> shelf.getOwner() != null && shelf.getOwner().getId().equals( currentUserId ) )
                   .sorted( Comparator.comparing( Shelf::getName, String.CASE_INSENSITIVE_ORDER ) )
                   .map( shelf -> ShelfSummary.builder().id( shelf.getId() ).name( shelf.getName() ).build() )
                   .toList();
    }

    /** Владелец тегов записи: у новой это тот, кто её заводит, у чужой — тот, кто её завёл. */
    private User tagOwner( LibraryItem item ) {
        return item.getCreatedBy() != null ? item.getCreatedBy() : userService.getCurrentUser();
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

    private LibraryItemResponse toResponse( LibraryItem item, List<AuthorSummary> authors, List<TagSummary> tags,
                                            List<ShelfSummary> shelves ) {
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
                                  .tags( tags != null ? tags : List.of() )
                                  .shelves( shelves != null ? shelves : List.of() )
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
                                  .note( item.getNote() )
                                  .review( item.getReview() )
                                  .reviewSpoiler( item.getReviewSpoiler() )
                                  .ratingPlot( item.getRatingPlot() )
                                  .ratingStyle( item.getRatingStyle() )
                                  .ratingCharacters( item.getRatingCharacters() )
                                  .ratingEnding( item.getRatingEnding() )
                                  .rating( item.getRating() )
                                  .favorite( item.isFavorite() )
                                  .wishlist( item.isWishlist() )
                                  .price( item.getPrice() )
                                  .currency( item.getCurrency() )
                                  .purchaseUrl( item.getPurchaseUrl() )
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
