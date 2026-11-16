package com.library.tracker.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.ActivityEvent;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.Author;
import com.library.tracker.domain.BookType;
import com.library.tracker.domain.ItemFormat;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Loan;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ProgressUnit;
import com.library.tracker.domain.Quote;
import com.library.tracker.domain.ReactionKind;
import com.library.tracker.domain.ReadingGoal;
import com.library.tracker.domain.ReadingLog;
import com.library.tracker.domain.ReadingSession;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.ReviewComment;
import com.library.tracker.domain.ReviewReaction;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.SavedFilter;
import com.library.tracker.domain.Series;
import com.library.tracker.domain.Session;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.ShelfRole;
import com.library.tracker.domain.SmartShelf;
import com.library.tracker.domain.Source;
import com.library.tracker.domain.SystemNode;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserAchievement;
import com.library.tracker.domain.UserFollow;
import com.library.tracker.repository.ActivityEventRepository;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.LoanRepository;
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
import com.library.tracker.service.DataExportService;
import com.library.tracker.service.export.SnapshotCollector;
import com.library.tracker.service.export.SnapshotRestorer;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Полный круг административного бэкапа на настоящей PostgreSQL: снять копию, испортить базу,
 * восстановиться из файла.
 * <p>
 * Проверять это без живой БД нечем. Восстановление кладёт записи прямо SQL-ом — с сохранением
 * идентификаторов, ради которых всё и затевалось, — поэтому ошибка в имени столбца, порядке
 * вставки или типе значения видна только настоящему PostgreSQL. Мок EntityManager-а принял бы
 * любой запрос.
 * <p>
 * Второй тест не менее важен первого: копия, снятая старой версией, должна подниматься на новой.
 * Файл там написан руками — ровно в том виде, в каком его выдавала версия до разделения заметки
 * и отзыва.
 */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( { JpaConfig.class, SnapshotCollector.class, SnapshotRestorer.class, DataExportService.class,
           DataBackupIntegrationTest.BackupConfiguration.class } )
class DataBackupIntegrationTest extends PostgresContainerTest {

    @TempDir
    static Path exportDirectory;

    @DynamicPropertySource
    static void exportProperties( DynamicPropertyRegistry registry ) {
        registry.add( "export.directory", () -> exportDirectory.toString() );
    }

    /** Тот же ObjectMapper, что собирает Spring Boot: даты строками, неизвестные поля игнорируются. */
    @TestConfiguration
    static class BackupConfiguration {

        @Bean
        ObjectMapper objectMapper() {
            return Jackson2ObjectMapperBuilder.json().build();
        }
    }

    @Autowired
    private DataExportService dataExportService;

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private BookTypeRepository bookTypeRepository;

    @Autowired
    private SourceRepository sourceRepository;

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private SeriesRepository seriesRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private ShelfRepository shelfRepository;

    @Autowired
    private ShelfMemberRepository shelfMemberRepository;

    @Autowired
    private SmartShelfRepository smartShelfRepository;

    @Autowired
    private ReadingLogRepository readingLogRepository;

    @Autowired
    private ReadingSessionRepository readingSessionRepository;

    @Autowired
    private QuoteRepository quoteRepository;

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private ReviewCommentRepository reviewCommentRepository;

    @Autowired
    private ReviewReactionRepository reviewReactionRepository;

    @Autowired
    private UserFollowRepository userFollowRepository;

    @Autowired
    private ActivityEventRepository activityEventRepository;

    @Autowired
    private ReadingGoalRepository readingGoalRepository;

    @Autowired
    private UserAchievementRepository userAchievementRepository;

    @Autowired
    private SystemNodeRepository systemNodeRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private SessionSettingsRepository sessionSettingsRepository;

    /**
     * Контейнер с БД один на весь прогон, а соседние тесты пишут в неё по-настоящему. Поэтому
     * всё, на что в схеме есть уникальный индекс, заводится с суффиксом, а проверки идут по
     * идентификаторам своих записей, а не по количеству строк в таблицах.
     */
    private String suffix;

    private User owner;
    private User reader;
    private LibraryItem item;
    private Shelf shelf;
    private ShelfMember member;
    private SmartShelf smartShelf;
    private ReadingLog log;
    private ReadingSession session;
    private Quote quote;
    private Loan loan;
    private ReviewComment comment;
    private ReviewReaction reaction;
    private UserFollow follow;
    private ActivityEvent event;
    private ReadingGoal goal;
    private UserAchievement achievement;
    private SystemNode node;
    private Session userSession;

    @BeforeEach
    void setUp() {
        suffix = UUID.randomUUID().toString().substring( 0, 8 );

        owner = entityManager.persist( user( "owner-" + suffix, Role.SUPER_ADMIN ) );
        reader = entityManager.persist( user( "reader-" + suffix, Role.USER ) );

        BookType type = entityManager.persist( type( "Фантастика-" + suffix ) );
        Source source = entityManager.persist( source( "Букинист-" + suffix ) );
        Author author = entityManager.persist( author( "Лю Цысинь " + suffix, "Liu Cixin" ) );
        Series series = entityManager.persist( series( "Память о прошлом Земли " + suffix ) );
        Tag tag = entityManager.persist( tag( "на лето", owner ) );

        item = entityManager.persist( item( type, source, series, author, tag ) );

        shelf = new Shelf();
        shelf.setOwner( owner );
        shelf.setName( "Книжный клуб" );
        shelf.setDescription( "Весна" );
        shelf.setPublic( true );
        shelf.setItems( new LinkedHashSet<>( Set.of( item ) ) );
        shelf = entityManager.persist( shelf );

        member = new ShelfMember();
        member.setShelf( shelf );
        member.setUser( reader );
        member.setRole( ShelfRole.CURATOR );
        member = entityManager.persist( member );

        smartShelf = new SmartShelf();
        smartShelf.setOwner( owner );
        smartShelf.setName( "Непрочитанная фантастика" );
        SavedFilter filter = new SavedFilter();
        filter.setStatus( ReadingStatus.PLANNED );
        filter.setMinRating( new BigDecimal( "8.0" ) );
        filter.setKind( MediaKind.BOOK );
        smartShelf.setFilter( filter );
        smartShelf = entityManager.persist( smartShelf );

        log = new ReadingLog();
        log.setItem( item );
        log.setAttempt( 1 );
        log.setStartedAt( LocalDate.of( 2024, 1, 5 ) );
        log.setFinishedAt( LocalDate.of( 2024, 2, 1 ) );
        log.setRating( new BigDecimal( "9.0" ) );
        log.setComment( "Первый заход" );
        log = entityManager.persist( log );

        session = new ReadingSession();
        session.setItem( item );
        session.setLog( log );
        session.setSessionDate( LocalDate.of( 2024, 1, 6 ) );
        session.setFromPosition( 0 );
        session.setToPosition( 40 );
        session.setDurationMinutes( 55 );
        session = entityManager.persist( session );

        quote = new Quote();
        quote.setItem( item );
        quote.setPosition( 42 );
        quote.setText( "Не отвечайте!" );
        quote = entityManager.persist( quote );

        loan = new Loan();
        loan.setItem( item );
        loan.setBorrowerName( "Аня" );
        loan.setLentOn( LocalDate.of( 2024, 3, 1 ) );
        loan.setDueOn( LocalDate.of( 2024, 4, 1 ) );
        loan = entityManager.persist( loan );

        comment = new ReviewComment();
        comment.setItem( item );
        comment.setAuthor( reader );
        comment.setBody( "Согласен" );
        comment = entityManager.persist( comment );

        reaction = new ReviewReaction();
        reaction.setItem( item );
        reaction.setUser( reader );
        reaction.setKind( ReactionKind.WANT_TO_READ );
        reaction = entityManager.persist( reaction );

        follow = new UserFollow();
        follow.setFollower( reader );
        follow.setFollowee( owner );
        follow = entityManager.persist( follow );

        event = new ActivityEvent();
        event.setActor( owner );
        event.setType( ActivityType.FINISHED_READING );
        event.setItem( item );
        event.setShelf( shelf );
        event.setSubject( "Задача трёх тел" );
        event = entityManager.persist( event );

        goal = new ReadingGoal();
        goal.setOwner( owner );
        goal.setYear( 2024 );
        goal.setTargetItems( 24 );
        goal = entityManager.persist( goal );

        achievement = new UserAchievement();
        achievement.setOwner( owner );
        achievement.setCode( "FIRST_ITEM" );
        achievement.setUnlockedOn( LocalDate.of( 2024, 2, 1 ) );
        achievement = entityManager.persist( achievement );

        node = new SystemNode();
        node.setNodeKey( "node-" + suffix );
        node.setHostname( "library-1" );
        node.setPort( 8080 );
        node.setCpuLoad( 0.25 );
        node = entityManager.persist( node );

        userSession = new Session();
        userSession.setUser( owner );
        userSession.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 30 ) );
        userSession.setMaxExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusHours( 24 ) );
        userSession = entityManager.persist( userSession );

        entityManager.flush();
    }

    @Test
    void backupSurvivesRoundTripWithEveryRelation() {
        DataExportService.ExportResult export = dataExportService.exportData();

        assertThat( export.getSchemaVersion() ).isEqualTo( 2 );
        // Копия — снимок всей базы, поэтому в счётчиках лежит и то, что записали соседние тесты.
        // Проверяется не число строк, а то, что раздел вообще попал в файл.
        assertThat( export.getCounts() ).containsKeys( "users", "libraryItems", "shelves", "quotes",
                                                       "activityEvents", "sessions", "readingLogs",
                                                       "userAchievements", "systemNodes" );

        UUID itemId = item.getId();
        UUID shelfId = shelf.getId();
        String strayUser = "stray-" + suffix;
        String strayType = "Лишний тип " + suffix;

        // Порча базы: то, чего в копии нет, восстановление обязано убрать, а изменённое — вернуть.
        item.setTitle( "Испорчено" );
        entityManager.persist( user( strayUser, Role.USER ) );
        entityManager.persist( type( strayType ) );
        entityManager.flush();

        DataExportService.ImportResult result = dataExportService.importData( export.getFileName() );

        assertThat( result.getSchemaVersion() ).isEqualTo( 2 );
        assertThat( result.getExportedAt() ).isEqualTo( export.getExportedAt() );
        // Восстановлено ровно столько, сколько было снято: ни одна запись копии не потерялась.
        assertThat( result.getRestoredUsers() ).isEqualTo( export.getUsersCount() );
        assertThat( result.getRestoredItems() ).isEqualTo( export.getItemsCount() );
        assertThat( result.getCounts() ).containsEntry( "itemAuthors", 1L )
                                        .containsEntry( "itemTags", 1L )
                                        .containsEntry( "shelfItems", 1L );

        // Появившееся после снятия копии уходит, а всё, что было в ней, встаёт на место.
        assertThat( userRepository.findAll() ).extracting( User::getUsername )
                                              .contains( owner.getUsername(), reader.getUsername() )
                                              .doesNotContain( strayUser );
        assertThat( bookTypeRepository.findAll() ).extracting( BookType::getName ).doesNotContain( strayType );

        LibraryItem restored = libraryItemRepository.findWithRelationsById( itemId ).orElseThrow();
        assertThat( restored.getTitle() ).isEqualTo( "Задача трёх тел" );
        assertThat( restored.getAltTitle() ).isEqualTo( "The Three-Body Problem" );
        assertThat( restored.getKind() ).isEqualTo( MediaKind.BOOK );
        assertThat( restored.getStatus() ).isEqualTo( ReadingStatus.COMPLETED );
        assertThat( restored.getFormat() ).isEqualTo( ItemFormat.PAPER );
        assertThat( restored.getProgressUnit() ).isEqualTo( ProgressUnit.PAGES );
        assertThat( restored.getProgressCurrent() ).isEqualTo( 400 );
        assertThat( restored.getRating() ).isEqualByComparingTo( "9.5" );
        assertThat( restored.getRatingPlot() ).isEqualByComparingTo( "9.0" );
        assertThat( restored.getRatingEnding() ).isEqualByComparingTo( "9.0" );
        assertThat( restored.getOrderInSeries() ).isEqualByComparingTo( "1.00" );
        assertThat( restored.getPrice() ).isEqualByComparingTo( "790.00" );
        assertThat( restored.getCurrency() ).isEqualTo( "RUB" );
        assertThat( restored.isFavorite() ).isTrue();
        assertThat( restored.isWishlist() ).isTrue();
        assertThat( restored.getNote() ).isEqualTo( "Дочитать до отпуска" );
        assertThat( restored.getReview() ).isEqualTo( "Лучшее, что читал" );
        assertThat( restored.getReviewSpoiler() ).isEqualTo( "Финал" );
        assertThat( restored.getIsbn() ).isEqualTo( "978-5-17-104967-6" );
        assertThat( restored.getTranslator() ).isEqualTo( "О. Глушкова" );
        assertThat( restored.getBookcase() ).isEqualTo( "Шкаф 1" );
        assertThat( restored.getShelf() ).isEqualTo( "Полка 2" );
        // Файл обложки лежит в объектном хранилище, а ключ к нему — в базе и в копии.
        assertThat( restored.getCoverKey() ).isEqualTo( "covers/three-body" );
        assertThat( restored.getStartedAt() ).isEqualTo( LocalDate.of( 2024, 1, 5 ) );
        assertThat( restored.getDeadline() ).isEqualTo( LocalDate.of( 2024, 3, 1 ) );
        assertThat( restored.getAuthors() ).extracting( Author::getName ).containsExactly( "Лю Цысинь " + suffix );
        assertThat( restored.getType().getName() ).isEqualTo( "Фантастика-" + suffix );
        assertThat( restored.getSource().getName() ).isEqualTo( "Букинист-" + suffix );
        assertThat( restored.getSeries().getName() ).isEqualTo( "Память о прошлом Земли " + suffix );
        assertThat( restored.getCreatedBy().getUsername() ).isEqualTo( owner.getUsername() );

        User restoredOwner = userRepository.findById( owner.getId() ).orElseThrow();
        assertThat( restoredOwner.getRole() ).isEqualTo( Role.SUPER_ADMIN );
        assertThat( restoredOwner.isPublicProfile() ).isTrue();
        assertThat( restoredOwner.getBio() ).isEqualTo( "О себе" );
        // Аватар лежит в самой базе, поэтому обязан пережить круг вместе со всем остальным.
        assertThat( restoredOwner.getAvatar() ).containsExactly( 1, 2, 3 );

        assertThat( tagRepository.findById( restored.getTags().iterator().next().getId() ) ).isPresent();
        assertThat( restored.getTags() ).extracting( Tag::getName ).containsExactly( "на лето" );

        Shelf restoredShelf = shelfRepository.findById( shelfId ).orElseThrow();
        assertThat( restoredShelf.isPublic() ).isTrue();
        assertThat( restoredShelf.getDescription() ).isEqualTo( "Весна" );
        assertThat( restoredShelf.getItems() ).extracting( LibraryItem::getId ).containsExactly( itemId );
        assertThat( shelfMemberRepository.findById( member.getId() ).orElseThrow().getRole() )
                .isEqualTo( ShelfRole.CURATOR );

        SmartShelf restoredSmartShelf = smartShelfRepository.findById( smartShelf.getId() ).orElseThrow();
        assertThat( restoredSmartShelf.getFilter().getStatus() ).isEqualTo( ReadingStatus.PLANNED );
        assertThat( restoredSmartShelf.getFilter().getMinRating() ).isEqualByComparingTo( "8.0" );
        assertThat( restoredSmartShelf.getFilter().getKind() ).isEqualTo( MediaKind.BOOK );

        ReadingLog restoredLog = readingLogRepository.findById( log.getId() ).orElseThrow();
        assertThat( restoredLog.getAttempt() ).isEqualTo( 1 );
        assertThat( restoredLog.getComment() ).isEqualTo( "Первый заход" );
        assertThat( restoredLog.getRating() ).isEqualByComparingTo( "9.0" );

        ReadingSession restoredSession = readingSessionRepository.findById( session.getId() ).orElseThrow();
        assertThat( restoredSession.getToPosition() ).isEqualTo( 40 );
        assertThat( restoredSession.getDurationMinutes() ).isEqualTo( 55 );
        // Заход привязан к проходу — иначе перечитывания смешались бы в одну историю.
        assertThat( restoredSession.getLog().getId() ).isEqualTo( log.getId() );

        assertThat( quoteRepository.findById( quote.getId() ).orElseThrow().getText() ).isEqualTo( "Не отвечайте!" );
        assertThat( loanRepository.findById( loan.getId() ).orElseThrow().getBorrowerName() ).isEqualTo( "Аня" );
        assertThat( reviewCommentRepository.findById( comment.getId() ).orElseThrow().getBody() )
                .isEqualTo( "Согласен" );
        assertThat( reviewReactionRepository.findById( reaction.getId() ).orElseThrow().getKind() )
                .isEqualTo( ReactionKind.WANT_TO_READ );
        assertThat( userFollowRepository.findById( follow.getId() ) ).isPresent();

        ActivityEvent restoredEvent = activityEventRepository.findById( event.getId() ).orElseThrow();
        assertThat( restoredEvent.getType() ).isEqualTo( ActivityType.FINISHED_READING );
        assertThat( restoredEvent.getShelf().getId() ).isEqualTo( shelfId );
        assertThat( restoredEvent.getSubject() ).isEqualTo( "Задача трёх тел" );

        assertThat( readingGoalRepository.findById( goal.getId() ).orElseThrow().getTargetItems() ).isEqualTo( 24 );
        assertThat( userAchievementRepository.findById( achievement.getId() ).orElseThrow().getCode() )
                .isEqualTo( "FIRST_ITEM" );
        assertThat( systemNodeRepository.findById( node.getId() ).orElseThrow().getNodeKey() )
                .isEqualTo( "node-" + suffix );
        assertThat( sessionRepository.findById( userSession.getId() ) ).isPresent();
        assertThat( sessionSettingsRepository.findById( 1L ) ).isPresent();
    }

    /**
     * Копия версии 1: без {@code schemaVersion}, без разделов, появившихся позже, и с заметкой
     * в поле {@code comment}. Такие файлы лежат у пользователей на дисках, и они обязаны
     * подниматься — иначе бэкап оказывается страховкой ровно до следующего релиза.
     */
    @Test
    void legacyBackupWithoutNewSectionsIsRestored() throws IOException {
        UUID legacyUserId = UUID.randomUUID();
        UUID legacyTypeId = UUID.randomUUID();
        UUID legacyItemId = UUID.randomUUID();
        String legacy = """
                {
                  "exportedAt" : "2024-05-01T02:00:00Z",
                  "users" : [ {
                    "id" : "%s",
                    "username" : "legacy",
                    "password" : "{noop}secret",
                    "role" : "ADMIN",
                    "blocked" : false,
                    "createdAt" : "2024-01-01T00:00:00Z",
                    "updatedAt" : "2024-01-01T00:00:00Z"
                  } ],
                  "bookTypes" : [ {
                    "id" : "%s",
                    "name" : "Роман",
                    "createdAt" : "2024-01-01T00:00:00Z",
                    "updatedAt" : "2024-01-01T00:00:00Z"
                  } ],
                  "sources" : [ ],
                  "libraryItems" : [ {
                    "id" : "%s",
                    "kind" : "BOOK",
                    "title" : "Старая запись",
                    "typeId" : "%s",
                    "typeName" : "Роман",
                    "createdById" : "%s",
                    "comment" : "Заметка из старой копии",
                    "rating" : 7.5,
                    "favorite" : true,
                    "status" : "COMPLETED",
                    "createdAt" : "2024-01-02T00:00:00Z",
                    "updatedAt" : "2024-01-02T00:00:00Z"
                  } ],
                  "sessionSettings" : {
                    "sessionTtlMinutes" : 45,
                    "maxSessionLifetimeMinutes" : 720
                  }
                }
                """.formatted( legacyUserId, legacyTypeId, legacyItemId, legacyTypeId, legacyUserId );
        Files.writeString( exportDirectory.resolve( "legacy.json" ), legacy, StandardCharsets.UTF_8 );

        DataExportService.ImportResult result = dataExportService.importData( "legacy.json" );

        assertThat( result.getSchemaVersion() ).isEqualTo( 1 );
        assertThat( result.getRestoredUsers() ).isEqualTo( 1 );
        assertThat( result.getRestoredItems() ).isEqualTo( 1 );

        User restoredUser = userRepository.findById( legacyUserId ).orElseThrow();
        assertThat( restoredUser.getUsername() ).isEqualTo( "legacy" );
        assertThat( restoredUser.getRole() ).isEqualTo( Role.ADMIN );
        // Профилей в первой версии не было: закрытый — безопасное умолчание.
        assertThat( restoredUser.isPublicProfile() ).isFalse();

        LibraryItem restoredItem = libraryItemRepository.findWithRelationsById( legacyItemId ).orElseThrow();
        // comment писался «для себя» и переезжает в приватную заметку, а не в публичный отзыв.
        assertThat( restoredItem.getNote() ).isEqualTo( "Заметка из старой копии" );
        assertThat( restoredItem.getReview() ).isNull();
        assertThat( restoredItem.isFavorite() ).isTrue();
        assertThat( restoredItem.isWishlist() ).isFalse();
        assertThat( restoredItem.getType().getName() ).isEqualTo( "Роман" );
        assertThat( restoredItem.getAuthors() ).isEmpty();

        // Разделов, появившихся позже, в файле нет — и после восстановления их быть не должно.
        assertThat( shelfRepository.findAll() ).isEmpty();
        assertThat( tagRepository.findAll() ).isEmpty();
        assertThat( quoteRepository.findAll() ).isEmpty();
        assertThat( sessionRepository.findAll() ).isEmpty();

        assertThat( sessionSettingsRepository.findById( 1L ).orElseThrow().getSessionTtlMinutes() ).isEqualTo( 45 );
    }

    /** Ссылка, которой некуда указать, не должна ронять восстановление всей копии. */
    @Test
    void backupWithDanglingReferencesIsRestoredWithoutThem() throws IOException {
        UUID itemId = UUID.randomUUID();
        String broken = """
                {
                  "schemaVersion" : 2,
                  "exportedAt" : "2025-05-01T02:00:00Z",
                  "users" : [ ],
                  "libraryItems" : [ {
                    "id" : "%s",
                    "kind" : "НЕВЕДОМЫЙ_ВИД",
                    "title" : "Запись без владельца",
                    "createdById" : "%s",
                    "typeId" : "%s",
                    "status" : "COMPLETED"
                  } ],
                  "quotes" : [ {
                    "id" : "%s",
                    "itemId" : "%s",
                    "text" : "Выписка из несуществующей книги"
                  } ]
                }
                """.formatted( itemId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID() );
        Files.writeString( exportDirectory.resolve( "broken.json" ), broken, StandardCharsets.UTF_8 );

        DataExportService.ImportResult result = dataExportService.importData( "broken.json" );

        assertThat( result.getRestoredItems() ).isEqualTo( 1 );
        LibraryItem restored = libraryItemRepository.findById( itemId ).orElseThrow();
        // Необязательные ссылки снимаются, запись остаётся.
        assertThat( restored.getCreatedBy() ).isNull();
        assertThat( restored.getType() ).isNull();
        // Неизвестное значение перечисления заменяется умолчанием, а не рушит разбор файла.
        assertThat( restored.getKind() ).isEqualTo( MediaKind.BOOK );
        // А выписка без произведения восстановлению не подлежит: ссылка обязательная.
        assertThat( quoteRepository.findAll() ).isEmpty();
    }

    private User user( String username, Role role ) {
        User user = new User();
        user.setUsername( username );
        user.setPassword( "{noop}secret" );
        user.setRole( role );
        user.setDisplayName( username + " display" );
        user.setBio( "О себе" );
        user.setPublicProfile( true );
        user.setAvatar( new byte[] { 1, 2, 3 } );
        user.setAvatarContentType( "image/png" );
        return user;
    }

    private BookType type( String name ) {
        BookType type = new BookType();
        type.setName( name );
        return type;
    }

    private Source source( String name ) {
        Source source = new Source();
        source.setName( name );
        source.setUrl( "https://example.org" );
        source.setDescription( "Лавка" );
        return source;
    }

    private Author author( String name, String altName ) {
        Author author = new Author();
        author.setName( name );
        author.setAltName( altName );
        return author;
    }

    private Series series( String name ) {
        Series series = new Series();
        series.setName( name );
        return series;
    }

    private Tag tag( String name, User owner ) {
        Tag tag = new Tag();
        tag.setOwner( owner );
        tag.setName( name );
        tag.setColor( "#ff8800" );
        return tag;
    }

    private LibraryItem item( BookType type, Source source, Series series, Author author, Tag tag ) {
        LibraryItem item = new LibraryItem();
        item.setKind( MediaKind.BOOK );
        item.setTitle( "Задача трёх тел" );
        item.setAltTitle( "The Three-Body Problem" );
        item.setType( type );
        item.setSource( source );
        item.setSeries( series );
        item.setOrderInSeries( new BigDecimal( "1.00" ) );
        item.setCreatedBy( owner );
        item.setAuthors( new LinkedHashSet<>( Set.of( author ) ) );
        item.setTags( new LinkedHashSet<>( Set.of( tag ) ) );
        item.setIsbn( "978-5-17-104967-6" );
        item.setPublishedYear( 2006 );
        item.setLanguage( "ru" );
        item.setPageCount( 400 );
        item.setTranslator( "О. Глушкова" );
        item.setCoverKey( "covers/three-body" );
        item.setCoverContentType( "image/jpeg" );
        item.setFormat( ItemFormat.PAPER );
        item.setBookcase( "Шкаф 1" );
        item.setShelf( "Полка 2" );
        item.setStartedAt( LocalDate.of( 2024, 1, 5 ) );
        item.setFinishedAt( LocalDate.of( 2024, 2, 1 ) );
        item.setDeadline( LocalDate.of( 2024, 3, 1 ) );
        item.setProgressCurrent( 400 );
        item.setProgressTotal( 400 );
        item.setProgressUnit( ProgressUnit.PAGES );
        item.setNote( "Дочитать до отпуска" );
        item.setReview( "Лучшее, что читал" );
        item.setReviewSpoiler( "Финал" );
        item.setRating( new BigDecimal( "9.5" ) );
        item.setRatingPlot( new BigDecimal( "9.0" ) );
        item.setRatingStyle( new BigDecimal( "8.0" ) );
        item.setRatingCharacters( new BigDecimal( "8.5" ) );
        item.setRatingEnding( new BigDecimal( "9.0" ) );
        item.setFavorite( true );
        item.setWishlist( true );
        item.setPrice( new BigDecimal( "790.00" ) );
        item.setCurrency( "RUB" );
        item.setPurchaseUrl( "https://example.org/buy" );
        item.setStatus( ReadingStatus.COMPLETED );
        return item;
    }
}
