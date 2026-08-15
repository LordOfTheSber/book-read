package com.library.tracker.service.export;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Session;
import com.library.tracker.repository.ActivityEventRepository;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.repository.MonitoringSettingsRepository;
import com.library.tracker.repository.QuoteRepository;
import com.library.tracker.repository.ReadingGoalRepository;
import com.library.tracker.repository.ReadingLogRepository;
import com.library.tracker.repository.ReadingSessionRepository;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.ReviewReactionRepository;
import com.library.tracker.repository.SeriesRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.SessionSettingsRepository;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.SmartShelfRepository;
import com.library.tracker.repository.SourceRepository;
import com.library.tracker.repository.SystemNodeRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Снимает состояние базы в {@link ExportPayload}. Обратная операция — {@link SnapshotRestorer}.
 * <p>
 * Связи читаются по идентификаторам: {@code item.getType().getId()} у ленивого прокси не идёт
 * в базу, поэтому обход библиотеки не превращается в запрос на строку. Коллекции связей
 * (авторы, теги, состав полок) берутся тремя запросами к таблицам связей — по одному на таблицу,
 * а не по одному на запись.
 */
@Component
@RequiredArgsConstructor
public class SnapshotCollector {

    private final UserRepository userRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;
    private final SourceRepository sourceRepository;
    private final AuthorRepository authorRepository;
    private final SeriesRepository seriesRepository;
    private final TagRepository tagRepository;
    private final ShelfRepository shelfRepository;
    private final ShelfMemberRepository shelfMemberRepository;
    private final SmartShelfRepository smartShelfRepository;
    private final ReadingLogRepository readingLogRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final QuoteRepository quoteRepository;
    private final LoanRepository loanRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final ReviewReactionRepository reviewReactionRepository;
    private final UserFollowRepository userFollowRepository;
    private final ActivityEventRepository activityEventRepository;
    private final ReadingGoalRepository readingGoalRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final SystemNodeRepository systemNodeRepository;
    private final SessionRepository sessionRepository;
    private final SessionSettingsRepository sessionSettingsRepository;
    private final MonitoringSettingsRepository monitoringSettingsRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional( readOnly = true )
    public ExportPayload collect( OffsetDateTime exportedAt ) {
        Map<UUID, List<UUID>> itemAuthors = links( "SELECT item_id, author_id FROM library_item_authors" );
        Map<UUID, List<UUID>> itemTags = links( "SELECT item_id, tag_id FROM library_item_tags" );
        Map<UUID, List<UUID>> shelfItems = links( "SELECT shelf_id, item_id FROM shelf_items" );

        return ExportPayload.builder()
                            .schemaVersion( ExportPayload.CURRENT_SCHEMA_VERSION )
                            .exportedAt( exportedAt )
                            .users( users() )
                            .bookTypes( bookTypes() )
                            .sources( sources() )
                            .authors( authors() )
                            .series( series() )
                            .tags( tags() )
                            .shelves( shelves( shelfItems ) )
                            .shelfMembers( shelfMembers() )
                            .smartShelves( smartShelves() )
                            .libraryItems( libraryItems( itemAuthors, itemTags ) )
                            .readingLogs( readingLogs() )
                            .readingSessions( readingSessions() )
                            .quotes( quotes() )
                            .loans( loans() )
                            .reviewComments( reviewComments() )
                            .reviewReactions( reviewReactions() )
                            .userFollows( userFollows() )
                            .activityEvents( activityEvents() )
                            .readingGoals( readingGoals() )
                            .userAchievements( userAchievements() )
                            .systemNodes( systemNodes() )
                            .sessions( sessions() )
                            .sessionSettings( sessionSettings() )
                            .monitoringSettings( monitoringSettings() )
                            .build();
    }

    private List<ExportPayload.UserExport> users() {
        return userRepository.findAll()
                             .stream()
                             .map( user -> ExportPayload.UserExport
                                     .builder()
                                     .id( user.getId() )
                                     .username( user.getUsername() )
                                     .password( user.getPassword() )
                                     .role( name( user.getRole() ) )
                                     .blocked( user.isBlocked() )
                                     .avatarBase64( encode( user.getAvatar() ) )
                                     .avatarContentType( user.getAvatarContentType() )
                                     .sessionTtlOverrideMinutes( user.getSessionTtlOverrideMinutes() )
                                     .maxSessionLifetimeOverrideMinutes( user.getMaxSessionLifetimeOverrideMinutes() )
                                     .displayName( user.getDisplayName() )
                                     .bio( user.getBio() )
                                     .publicProfile( user.isPublicProfile() )
                                     .createdAt( at( user.getCreatedAt() ) )
                                     .updatedAt( at( user.getUpdatedAt() ) )
                                     .build() )
                             .toList();
    }

    private List<ExportPayload.BookTypeExport> bookTypes() {
        return bookTypeRepository.findAll()
                                 .stream()
                                 .map( type -> ExportPayload.BookTypeExport.builder()
                                                                           .id( type.getId() )
                                                                           .name( type.getName() )
                                                                           .createdAt( at( type.getCreatedAt() ) )
                                                                           .updatedAt( at( type.getUpdatedAt() ) )
                                                                           .build() )
                                 .toList();
    }

    private List<ExportPayload.SourceExport> sources() {
        return sourceRepository.findAll()
                               .stream()
                               .map( source -> ExportPayload.SourceExport.builder()
                                                                         .id( source.getId() )
                                                                         .name( source.getName() )
                                                                         .url( source.getUrl() )
                                                                         .description( source.getDescription() )
                                                                         .createdAt( at( source.getCreatedAt() ) )
                                                                         .updatedAt( at( source.getUpdatedAt() ) )
                                                                         .build() )
                               .toList();
    }

    private List<ExportPayload.AuthorExport> authors() {
        return authorRepository.findAll()
                               .stream()
                               .map( author -> ExportPayload.AuthorExport.builder()
                                                                         .id( author.getId() )
                                                                         .name( author.getName() )
                                                                         .altName( author.getAltName() )
                                                                         .createdAt( at( author.getCreatedAt() ) )
                                                                         .updatedAt( at( author.getUpdatedAt() ) )
                                                                         .build() )
                               .toList();
    }

    private List<ExportPayload.SeriesExport> series() {
        return seriesRepository.findAll()
                               .stream()
                               .map( series -> ExportPayload.SeriesExport.builder()
                                                                         .id( series.getId() )
                                                                         .name( series.getName() )
                                                                         .description( series.getDescription() )
                                                                         .createdAt( at( series.getCreatedAt() ) )
                                                                         .updatedAt( at( series.getUpdatedAt() ) )
                                                                         .build() )
                               .toList();
    }

    private List<ExportPayload.TagExport> tags() {
        return tagRepository.findAll()
                            .stream()
                            .map( tag -> ExportPayload.TagExport.builder()
                                                                .id( tag.getId() )
                                                                .ownerId( tag.getOwner().getId() )
                                                                .name( tag.getName() )
                                                                .color( tag.getColor() )
                                                                .createdAt( at( tag.getCreatedAt() ) )
                                                                .updatedAt( at( tag.getUpdatedAt() ) )
                                                                .build() )
                            .toList();
    }

    private List<ExportPayload.ShelfExport> shelves( Map<UUID, List<UUID>> shelfItems ) {
        return shelfRepository.findAll()
                              .stream()
                              .map( shelf -> ExportPayload.ShelfExport
                                      .builder()
                                      .id( shelf.getId() )
                                      .ownerId( shelf.getOwner().getId() )
                                      .name( shelf.getName() )
                                      .description( shelf.getDescription() )
                                      .publicShelf( shelf.isPublic() )
                                      .itemIds( shelfItems.getOrDefault( shelf.getId(), List.of() ) )
                                      .createdAt( at( shelf.getCreatedAt() ) )
                                      .updatedAt( at( shelf.getUpdatedAt() ) )
                                      .build() )
                              .toList();
    }

    private List<ExportPayload.ShelfMemberExport> shelfMembers() {
        return shelfMemberRepository.findAll()
                                    .stream()
                                    .map( member -> ExportPayload.ShelfMemberExport
                                            .builder()
                                            .id( member.getId() )
                                            .shelfId( member.getShelf().getId() )
                                            .userId( member.getUser().getId() )
                                            .role( name( member.getRole() ) )
                                            .createdAt( at( member.getCreatedAt() ) )
                                            .updatedAt( at( member.getUpdatedAt() ) )
                                            .build() )
                                    .toList();
    }

    private List<ExportPayload.SmartShelfExport> smartShelves() {
        return smartShelfRepository.findAll()
                                   .stream()
                                   .map( shelf -> ExportPayload.SmartShelfExport
                                           .builder()
                                           .id( shelf.getId() )
                                           .ownerId( shelf.getOwner().getId() )
                                           .name( shelf.getName() )
                                           .description( shelf.getDescription() )
                                           .filter( shelf.getFilter() )
                                           .createdAt( at( shelf.getCreatedAt() ) )
                                           .updatedAt( at( shelf.getUpdatedAt() ) )
                                           .build() )
                                   .toList();
    }

    private List<ExportPayload.LibraryItemExport> libraryItems( Map<UUID, List<UUID>> itemAuthors,
                                                                Map<UUID, List<UUID>> itemTags ) {
        return libraryItemRepository.findAll().stream().map( item -> toExport( item, itemAuthors, itemTags ) ).toList();
    }

    private ExportPayload.LibraryItemExport toExport( LibraryItem item,
                                                      Map<UUID, List<UUID>> itemAuthors,
                                                      Map<UUID, List<UUID>> itemTags ) {
        return ExportPayload.LibraryItemExport
                .builder()
                .id( item.getId() )
                .kind( name( item.getKind() ) )
                .title( item.getTitle() )
                .altTitle( item.getAltTitle() )
                .typeId( item.getType() != null ? item.getType().getId() : null )
                .typeName( item.getType() != null ? item.getType().getName() : null )
                .sourceId( item.getSource() != null ? item.getSource().getId() : null )
                .sourceName( item.getSource() != null ? item.getSource().getName() : null )
                .createdById( item.getCreatedBy() != null ? item.getCreatedBy().getId() : null )
                .seriesId( item.getSeries() != null ? item.getSeries().getId() : null )
                .orderInSeries( item.getOrderInSeries() )
                .authorIds( itemAuthors.getOrDefault( item.getId(), List.of() ) )
                .tagIds( itemTags.getOrDefault( item.getId(), List.of() ) )
                .isbn( item.getIsbn() )
                .publishedYear( item.getPublishedYear() )
                .language( item.getLanguage() )
                .pageCount( item.getPageCount() )
                .translator( item.getTranslator() )
                .coverKey( item.getCoverKey() )
                .coverContentType( item.getCoverContentType() )
                .format( name( item.getFormat() ) )
                .bookcase( item.getBookcase() )
                .shelfLabel( item.getShelf() )
                .startedAt( item.getStartedAt() )
                .finishedAt( item.getFinishedAt() )
                .deadline( item.getDeadline() )
                .progressCurrent( item.getProgressCurrent() )
                .progressTotal( item.getProgressTotal() )
                .progressUnit( name( item.getProgressUnit() ) )
                .note( item.getNote() )
                .review( item.getReview() )
                .reviewSpoiler( item.getReviewSpoiler() )
                .rating( item.getRating() )
                .ratingPlot( item.getRatingPlot() )
                .ratingStyle( item.getRatingStyle() )
                .ratingCharacters( item.getRatingCharacters() )
                .ratingEnding( item.getRatingEnding() )
                .favorite( item.isFavorite() )
                .wishlist( item.isWishlist() )
                .price( item.getPrice() )
                .currency( item.getCurrency() )
                .purchaseUrl( item.getPurchaseUrl() )
                .status( name( item.getStatus() ) )
                .createdAt( at( item.getCreatedAt() ) )
                .updatedAt( at( item.getUpdatedAt() ) )
                .build();
    }

    private List<ExportPayload.ReadingLogExport> readingLogs() {
        return readingLogRepository.findAll()
                                   .stream()
                                   .map( log -> ExportPayload.ReadingLogExport
                                           .builder()
                                           .id( log.getId() )
                                           .itemId( log.getItem().getId() )
                                           .attempt( log.getAttempt() )
                                           .startedAt( log.getStartedAt() )
                                           .finishedAt( log.getFinishedAt() )
                                           .rating( log.getRating() )
                                           .ratingPlot( log.getRatingPlot() )
                                           .ratingStyle( log.getRatingStyle() )
                                           .ratingCharacters( log.getRatingCharacters() )
                                           .ratingEnding( log.getRatingEnding() )
                                           .comment( log.getComment() )
                                           .createdAt( at( log.getCreatedAt() ) )
                                           .updatedAt( at( log.getUpdatedAt() ) )
                                           .build() )
                                   .toList();
    }

    private List<ExportPayload.ReadingSessionExport> readingSessions() {
        return readingSessionRepository.findAll()
                                       .stream()
                                       .map( session -> ExportPayload.ReadingSessionExport
                                               .builder()
                                               .id( session.getId() )
                                               .itemId( session.getItem().getId() )
                                               .logId( session.getLog() != null ? session.getLog().getId() : null )
                                               .sessionDate( session.getSessionDate() )
                                               .fromPosition( session.getFromPosition() )
                                               .toPosition( session.getToPosition() )
                                               .durationMinutes( session.getDurationMinutes() )
                                               .note( session.getNote() )
                                               .createdAt( at( session.getCreatedAt() ) )
                                               .updatedAt( at( session.getUpdatedAt() ) )
                                               .build() )
                                       .toList();
    }

    private List<ExportPayload.QuoteExport> quotes() {
        return quoteRepository.findAll()
                              .stream()
                              .map( quote -> ExportPayload.QuoteExport.builder()
                                                                      .id( quote.getId() )
                                                                      .itemId( quote.getItem().getId() )
                                                                      .position( quote.getPosition() )
                                                                      .text( quote.getText() )
                                                                      .note( quote.getNote() )
                                                                      .createdAt( at( quote.getCreatedAt() ) )
                                                                      .updatedAt( at( quote.getUpdatedAt() ) )
                                                                      .build() )
                              .toList();
    }

    private List<ExportPayload.LoanExport> loans() {
        return loanRepository.findAll()
                             .stream()
                             .map( loan -> ExportPayload.LoanExport.builder()
                                                                   .id( loan.getId() )
                                                                   .itemId( loan.getItem().getId() )
                                                                   .borrowerName( loan.getBorrowerName() )
                                                                   .borrowerContact( loan.getBorrowerContact() )
                                                                   .lentOn( loan.getLentOn() )
                                                                   .dueOn( loan.getDueOn() )
                                                                   .returnedOn( loan.getReturnedOn() )
                                                                   .note( loan.getNote() )
                                                                   .createdAt( at( loan.getCreatedAt() ) )
                                                                   .updatedAt( at( loan.getUpdatedAt() ) )
                                                                   .build() )
                             .toList();
    }

    private List<ExportPayload.ReviewCommentExport> reviewComments() {
        return reviewCommentRepository.findAll()
                                      .stream()
                                      .map( comment -> ExportPayload.ReviewCommentExport
                                              .builder()
                                              .id( comment.getId() )
                                              .itemId( comment.getItem().getId() )
                                              .authorId( comment.getAuthor().getId() )
                                              .body( comment.getBody() )
                                              .createdAt( at( comment.getCreatedAt() ) )
                                              .updatedAt( at( comment.getUpdatedAt() ) )
                                              .build() )
                                      .toList();
    }

    private List<ExportPayload.ReviewReactionExport> reviewReactions() {
        return reviewReactionRepository.findAll()
                                       .stream()
                                       .map( reaction -> ExportPayload.ReviewReactionExport
                                               .builder()
                                               .id( reaction.getId() )
                                               .itemId( reaction.getItem().getId() )
                                               .userId( reaction.getUser().getId() )
                                               .kind( name( reaction.getKind() ) )
                                               .createdAt( at( reaction.getCreatedAt() ) )
                                               .updatedAt( at( reaction.getUpdatedAt() ) )
                                               .build() )
                                       .toList();
    }

    private List<ExportPayload.UserFollowExport> userFollows() {
        return userFollowRepository.findAll()
                                   .stream()
                                   .map( follow -> ExportPayload.UserFollowExport
                                           .builder()
                                           .id( follow.getId() )
                                           .followerId( follow.getFollower().getId() )
                                           .followeeId( follow.getFollowee().getId() )
                                           .createdAt( at( follow.getCreatedAt() ) )
                                           .updatedAt( at( follow.getUpdatedAt() ) )
                                           .build() )
                                   .toList();
    }

    private List<ExportPayload.ActivityEventExport> activityEvents() {
        return activityEventRepository.findAll()
                                      .stream()
                                      .map( event -> ExportPayload.ActivityEventExport
                                              .builder()
                                              .id( event.getId() )
                                              .actorId( event.getActor().getId() )
                                              .type( name( event.getType() ) )
                                              .itemId( event.getItem() != null ? event.getItem().getId() : null )
                                              .shelfId( event.getShelf() != null ? event.getShelf().getId() : null )
                                              .subject( event.getSubject() )
                                              .detail( event.getDetail() )
                                              .createdAt( at( event.getCreatedAt() ) )
                                              .updatedAt( at( event.getUpdatedAt() ) )
                                              .build() )
                                      .toList();
    }

    private List<ExportPayload.ReadingGoalExport> readingGoals() {
        return readingGoalRepository.findAll()
                                    .stream()
                                    .map( goal -> ExportPayload.ReadingGoalExport
                                            .builder()
                                            .id( goal.getId() )
                                            .ownerId( goal.getOwner().getId() )
                                            .year( goal.getYear() )
                                            .targetItems( goal.getTargetItems() )
                                            .targetPages( goal.getTargetPages() )
                                            .targetMinutes( goal.getTargetMinutes() )
                                            .createdAt( at( goal.getCreatedAt() ) )
                                            .updatedAt( at( goal.getUpdatedAt() ) )
                                            .build() )
                                    .toList();
    }

    private List<ExportPayload.UserAchievementExport> userAchievements() {
        return userAchievementRepository.findAll()
                                        .stream()
                                        .map( achievement -> ExportPayload.UserAchievementExport
                                                .builder()
                                                .id( achievement.getId() )
                                                .ownerId( achievement.getOwner().getId() )
                                                .code( achievement.getCode() )
                                                .unlockedOn( achievement.getUnlockedOn() )
                                                .createdAt( at( achievement.getCreatedAt() ) )
                                                .updatedAt( at( achievement.getUpdatedAt() ) )
                                                .build() )
                                        .toList();
    }

    private List<ExportPayload.SystemNodeExport> systemNodes() {
        return systemNodeRepository.findAll()
                                   .stream()
                                   .map( node -> ExportPayload.SystemNodeExport
                                           .builder()
                                           .id( node.getId() )
                                           .nodeKey( node.getNodeKey() )
                                           .hostname( node.getHostname() )
                                           .ip( node.getIp() )
                                           .port( node.getPort() )
                                           .cpuLoad( node.getCpuLoad() )
                                           .systemMemoryTotal( node.getSystemMemoryTotal() )
                                           .systemMemoryFree( node.getSystemMemoryFree() )
                                           .heapUsed( node.getHeapUsed() )
                                           .heapCommitted( node.getHeapCommitted() )
                                           .heapMax( node.getHeapMax() )
                                           .diskTotal( node.getDiskTotal() )
                                           .diskFree( node.getDiskFree() )
                                           .uptimeSeconds( node.getUptimeSeconds() )
                                           .lastReportedAt( at( node.getLastReportedAt() ) )
                                           .createdAt( at( node.getCreatedAt() ) )
                                           .updatedAt( at( node.getUpdatedAt() ) )
                                           .build() )
                                   .toList();
    }

    private List<ExportPayload.SessionExport> sessions() {
        List<ExportPayload.SessionExport> sessions = new ArrayList<>();
        for ( Session session : sessionRepository.findAll() ) {
            sessions.add( ExportPayload.SessionExport.builder()
                                                     .id( session.getId() )
                                                     .userId( session.getUser().getId() )
                                                     .expiresAt( session.getExpiresAt() )
                                                     .maxExpiresAt( session.getMaxExpiresAt() )
                                                     .createdAt( at( session.getCreatedAt() ) )
                                                     .updatedAt( at( session.getUpdatedAt() ) )
                                                     .build() );
        }
        return sessions;
    }

    private ExportPayload.SessionSettingsExport sessionSettings() {
        return sessionSettingsRepository.findById( 1L )
                                        .map( settings -> ExportPayload.SessionSettingsExport
                                                .builder()
                                                .sessionTtlMinutes( settings.getSessionTtlMinutes() )
                                                .maxSessionLifetimeMinutes( settings.getMaxSessionLifetimeMinutes() )
                                                .createdAt( at( settings.getCreatedAt() ) )
                                                .updatedAt( at( settings.getUpdatedAt() ) )
                                                .build() )
                                        .orElse( null );
    }

    private ExportPayload.MonitoringSettingsExport monitoringSettings() {
        return monitoringSettingsRepository.findById( 1L )
                                           .map( settings -> ExportPayload.MonitoringSettingsExport
                                                   .builder()
                                                   .metricsEnabled( settings.getMetricsEnabled() )
                                                   .pingIntervalSeconds( settings.getPingIntervalSeconds() )
                                                   .pingPath( settings.getPingPath() )
                                                   .createdAt( at( settings.getCreatedAt() ) )
                                                   .updatedAt( at( settings.getUpdatedAt() ) )
                                                   .build() )
                                           .orElse( null );
    }

    /**
     * Таблица связи целиком, разложенная по владельцу. Через JPA те же данные обошлись бы
     * запросом на каждую запись: коллекции ленивые, а сущность связи здесь не заведена.
     */
    private Map<UUID, List<UUID>> links( String sql ) {
        Map<UUID, List<UUID>> grouped = new LinkedHashMap<>();
        @SuppressWarnings( "unchecked" )
        List<Object[]> rows = entityManager.createNativeQuery( sql ).getResultList();
        for ( Object[] row : rows ) {
            UUID owner = uuid( row[0] );
            UUID target = uuid( row[1] );
            if ( owner != null && target != null ) {
                grouped.computeIfAbsent( owner, key -> new ArrayList<>() ).add( target );
            }
        }
        return grouped;
    }

    private UUID uuid( Object value ) {
        if ( value instanceof UUID id ) {
            return id;
        }
        return value != null ? UUID.fromString( value.toString() ) : null;
    }

    private String name( Enum<?> value ) {
        return value != null ? value.name() : null;
    }

    private OffsetDateTime at( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }

    private String encode( byte[] content ) {
        return content != null ? Base64.getEncoder().encodeToString( content ) : null;
    }
}
