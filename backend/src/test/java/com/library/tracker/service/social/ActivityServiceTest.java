package com.library.tracker.service.social;

import com.library.tracker.domain.ActivityEvent;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ActivityEventRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ReviewCommentRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ActivityResponse;
import com.library.tracker.web.dto.PublicReviewResponse;
import com.library.tracker.web.dto.TrendingBookResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ActivityServiceTest {

    private static final Clock CLOCK = Clock.fixed( Instant.parse( "2026-08-22T12:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private ActivityEventRepository activityEventRepository;

    @Mock
    private ReviewCommentRepository reviewCommentRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private UserFollowRepository userFollowRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserService userService;

    @Mock
    private PublicReviewMapper publicReviewMapper;

    @Mock
    private ReviewAccess reviewAccess;

    private ActivityService service;

    private User reader;

    @BeforeEach
    void setUp() {
        service = new ActivityService( activityEventRepository, reviewCommentRepository, libraryItemRepository,
                                       userFollowRepository, userRepository, userService,
                                       new ProfileMapper( userFollowRepository ), publicReviewMapper,
                                       reviewAccess, CLOCK );
        reader = user( "reader" );
        lenient().when( userService.getCurrentUser() ).thenReturn( reader );
        lenient().when( userFollowRepository.findFolloweeIds( reader.getId() ) ).thenReturn( List.of() );
    }

    /** Лента показывает отзыв целиком, а не ссылку на него: без текста карточки не получится. */
    @Test
    void reviewEventCarriesTheReviewItself() {
        LibraryItem item = item( "Пикник на обочине" );
        feedReturns( event( ActivityType.PUBLISHED_REVIEW, item ) );
        when( libraryItemRepository.findAllWithAuthors( anyCollection() ) ).thenReturn( List.of( item ) );
        when( reviewAccess.canSee( eq( item ), eq( reader ) ) ).thenReturn( true );
        when( publicReviewMapper.toResponses( List.of( item ) ) ).thenReturn( List.of( review( item ) ) );

        List<ActivityResponse> feed = service.feed( null );

        assertThat( feed ).hasSize( 1 );
        assertThat( feed.get( 0 ).getReview() ).isNotNull();
        assertThat( feed.get( 0 ).getReview().getTitle() ).isEqualTo( "Пикник на обочине" );
    }

    /**
     * Открытость профиля автора события ещё не значит, что текст можно показать: отзыв могли
     * удалить, а карточку убрать с открытых полок. Событие остаётся, отзыв — нет.
     */
    @Test
    void hiddenReviewLeavesTheEventWithoutText() {
        LibraryItem item = item( "Дюна" );
        feedReturns( event( ActivityType.PUBLISHED_REVIEW, item ) );
        when( libraryItemRepository.findAllWithAuthors( anyCollection() ) ).thenReturn( List.of( item ) );
        when( reviewAccess.canSee( eq( item ), eq( reader ) ) ).thenReturn( false );
        when( publicReviewMapper.toResponses( List.of() ) ).thenReturn( List.of() );

        List<ActivityResponse> feed = service.feed( null );

        assertThat( feed ).hasSize( 1 );
        assertThat( feed.get( 0 ).getReview() ).isNull();
    }

    /** Мелкие события отзыва не носят: за ними не стоит текста, и ходить за ним незачем. */
    @Test
    void plainEventsDoNotAskForReviews() {
        feedReturns( event( ActivityType.FINISHED_READING, item( "Тёмный лес" ) ) );

        List<ActivityResponse> feed = service.feed( null );

        assertThat( feed.get( 0 ).getReview() ).isNull();
        verify( libraryItemRepository, never() ).findAllWithAuthors( anyCollection() );
    }

    /** Сводка складывает отзывы и комментарии недели: один отзыв без ответов — ещё не обсуждение. */
    @Test
    void trendingPutsDiscussedAhead() {
        LibraryItem talked = item( "Пикник на обочине" );
        LibraryItem written = item( "Дюна" );
        when( activityEventRepository.countReviewsSince( anyCollection(), any() ) )
                .thenReturn( List.of( itemCount( talked.getId(), 1 ), itemCount( written.getId(), 2 ) ) );
        when( reviewCommentRepository.countSince( anyCollection(), any() ) )
                .thenReturn( List.of( commentCount( talked.getId(), 6 ) ) );
        when( libraryItemRepository.findAllWithAuthors( anyCollection() ) ).thenReturn( List.of( written, talked ) );
        when( reviewAccess.canSee( any(), eq( reader ) ) ).thenReturn( true );

        List<TrendingBookResponse> trending = service.trending();

        assertThat( trending ).extracting( TrendingBookResponse::getTitle )
                              .containsExactly( "Пикник на обочине", "Дюна" );
        assertThat( trending.get( 0 ).getCommentCount() ).isEqualTo( 6 );
    }

    /** Окно ровно недельное: сводка отвечает «за неделю», а не «за последние N событий». */
    @Test
    void trendingLooksExactlyOneWeekBack() {
        when( activityEventRepository.countReviewsSince( anyCollection(), any() ) ).thenReturn( List.of() );
        when( reviewCommentRepository.countSince( anyCollection(), any() ) ).thenReturn( List.of() );

        assertThat( service.trending() ).isEmpty();

        ArgumentCaptor<LocalDateTime> since = ArgumentCaptor.forClass( LocalDateTime.class );
        verify( activityEventRepository ).countReviewsSince( anyCollection(), since.capture() );
        assertThat( since.getValue() ).isEqualTo( LocalDateTime.of( 2026, 8, 15, 12, 0 ) );
    }

    private void feedReturns( ActivityEvent... events ) {
        when( activityEventRepository.findByActorIdInOrderByCreatedAtDesc( anyCollection(), any() ) )
                .thenReturn( List.of( events ) );
    }

    private ActivityEvent event( ActivityType type, LibraryItem item ) {
        ActivityEvent event = new ActivityEvent();
        event.setId( UUID.randomUUID() );
        event.setType( type );
        event.setActor( reader );
        event.setItem( item );
        event.setCreatedAt( LocalDateTime.now( CLOCK ) );
        return event;
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setCreatedBy( reader );
        return item;
    }

    private PublicReviewResponse review( LibraryItem item ) {
        return PublicReviewResponse.builder().itemId( item.getId() ).title( item.getTitle() ).build();
    }

    private ActivityEventRepository.ItemCount itemCount( UUID itemId, long count ) {
        return new ActivityEventRepository.ItemCount() {

            @Override
            public UUID getItemId() {
                return itemId;
            }

            @Override
            public long getCount() {
                return count;
            }
        };
    }

    private ReviewCommentRepository.ItemCount commentCount( UUID itemId, long count ) {
        return new ReviewCommentRepository.ItemCount() {

            @Override
            public UUID getItemId() {
                return itemId;
            }

            @Override
            public long getCount() {
                return count;
            }
        };
    }

    private User user( String username ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        user.setRole( Role.USER );
        user.setPublicProfile( true );
        return user;
    }
}
