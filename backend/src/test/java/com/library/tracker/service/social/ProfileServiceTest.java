package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserFollow;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.service.engagement.StreakService;
import com.library.tracker.web.dto.ProfileUpdateRequest;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserFollowRepository userFollowRepository;

    @Mock
    private UserAchievementRepository userAchievementRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private UserService userService;

    @Mock
    private ActivityService activityService;

    @Mock
    private PublicReviewMapper publicReviewMapper;

    @Mock
    private StreakService streakService;

    private ProfileService service;

    private User reader;

    @BeforeEach
    void setUp() {
        service = new ProfileService( userRepository, userFollowRepository, userAchievementRepository,
                                      libraryItemRepository, shelfRepository, userService,
                                      new ProfileMapper( userFollowRepository ), activityService,
                                      publicReviewMapper, streakService );
        reader = user( "reader", false );
        lenient().when( userService.getCurrentUser() ).thenReturn( reader );
        lenient().when( userAchievementRepository.findByOwnerIdOrderByUnlockedOnAsc( any() ) ).thenReturn( List.of() );
        lenient().when( shelfRepository.findByOwnerIdOrderByNameAsc( any() ) ).thenReturn( List.of() );
        lenient().when( libraryItemRepository.findReviewed( any(), any() ) ).thenReturn( List.of() );
        lenient().when( publicReviewMapper.toResponses( any() ) ).thenReturn( List.of() );
    }

    /** Закрытый профиль отдаётся как отсутствующий: 404 не подтверждает существование логина. */
    @Test
    void closedProfileIsInvisibleToOthers() {
        User hermit = user( "hermit", false );
        when( userRepository.findByUsernameIgnoreCase( "hermit" ) ).thenReturn( Optional.of( hermit ) );

        assertThat( service.findByUsername( "hermit" ) ).isEmpty();
    }

    /** Свой профиль виден владельцу всегда — это заодно предпросмотр того, что увидят другие. */
    @Test
    void ownProfileIsVisibleWhileStillClosed() {
        when( userRepository.findByUsernameIgnoreCase( "reader" ) ).thenReturn( Optional.of( reader ) );

        assertThat( service.findByUsername( "reader" ) ).isPresent();
    }

    @Test
    void followingClosedProfileIsRejected() {
        User hermit = user( "hermit", false );
        when( userRepository.findByUsernameIgnoreCase( "hermit" ) ).thenReturn( Optional.of( hermit ) );

        assertThatThrownBy( () -> service.follow( "hermit" ) ).isInstanceOf( IllegalArgumentException.class );
        verify( userFollowRepository, never() ).save( any( UserFollow.class ) );
    }

    @Test
    void followingSelfIsRejected() {
        when( userRepository.findByUsernameIgnoreCase( "reader" ) ).thenReturn( Optional.of( reader ) );

        assertThatThrownBy( () -> service.follow( "reader" ) ).isInstanceOf( IllegalArgumentException.class );
        verify( userFollowRepository, never() ).save( any( UserFollow.class ) );
    }

    /** Повторная подписка не заводит вторую строку: пара «подписчик — автор» уникальна. */
    @Test
    void followingTwiceIsIdempotent() {
        User author = user( "author", true );
        when( userRepository.findByUsernameIgnoreCase( "author" ) ).thenReturn( Optional.of( author ) );
        when( userFollowRepository.existsByFollowerIdAndFolloweeId( eq( reader.getId() ), eq( author.getId() ) ) )
                .thenReturn( true );

        service.follow( "author" );

        verify( userFollowRepository, never() ).save( any( UserFollow.class ) );
    }

    /** Профиль читается из той же записи, что и учётные данные, — кэш нужно сбросить. */
    @Test
    void profileUpdateEvictsUserCache() {
        when( userRepository.save( any( User.class ) ) ).thenAnswer( call -> call.getArgument( 0 ) );

        ProfileUpdateRequest request = new ProfileUpdateRequest();
        request.setDisplayName( "  Читатель  " );
        request.setBio( "   " );
        request.setPublicProfile( true );

        var response = service.updateMyProfile( request );

        assertThat( response.getDisplayName() ).isEqualTo( "Читатель" );
        assertThat( response.getBio() ).isNull();
        assertThat( response.isPublicProfile() ).isTrue();
        verify( userService ).evictFromCache( reader );
    }

    /**
     * «Есть у вас» — то, ради чего к чужому профилю и ходят. Названия из отзывов проверяются
     * одним запросом, а не по запросу на строку.
     */
    @Test
    void foreignProfileMarksBooksTheReaderAlreadyHas() {
        User author = user( "author", true );
        LibraryItem reviewed = item( "Дюна" );
        when( userRepository.findByUsernameIgnoreCase( "author" ) ).thenReturn( Optional.of( author ) );
        when( libraryItemRepository.findReviewed( eq( author.getId() ), any() ) ).thenReturn( List.of( reviewed ) );
        when( libraryItemRepository.findOwnedTitles( eq( Set.of( "дюна" ) ), eq( reader.getId() ) ) )
                .thenReturn( List.of( "дюна" ) );
        when( libraryItemRepository.countCommonTitles( eq( reader.getId() ), eq( author.getId() ) ) ).thenReturn( 4L );

        var profile = service.findByUsername( "author" ).orElseThrow();

        assertThat( profile.getCommonCount() ).isEqualTo( 4 );
        verify( publicReviewMapper ).toResponses( List.of( reviewed ), Set.of( "дюна" ) );
    }

    /** В своём профиле отметка «есть у вас» стоит у каждой строки и не значит ничего. */
    @Test
    void ownProfileSkipsTheOwnedMarks() {
        when( userRepository.findByUsernameIgnoreCase( "reader" ) ).thenReturn( Optional.of( reader ) );
        when( libraryItemRepository.findReviewed( eq( reader.getId() ), any() ) )
                .thenReturn( List.of( item( "Дюна" ) ) );

        var profile = service.findByUsername( "reader" ).orElseThrow();

        assertThat( profile.getCommonCount() ).isZero();
        verify( libraryItemRepository, never() ).findOwnedTitles( any(), any() );
        verify( libraryItemRepository, never() ).countCommonTitles( any(), any() );
    }

    /** «Сейчас читает» — только читаемое и только обложками: чужой прогресс не показываем. */
    @Test
    void profileShowsWhatTheReaderIsReadingNow() {
        User author = user( "author", true );
        LibraryItem reading = item( "Тёмный лес" );
        when( userRepository.findByUsernameIgnoreCase( "author" ) ).thenReturn( Optional.of( author ) );
        when( libraryItemRepository.findReadingNow( eq( author.getId() ), any() ) ).thenReturn( List.of( reading ) );

        var profile = service.findByUsername( "author" ).orElseThrow();

        assertThat( profile.getCurrentlyReading() ).singleElement()
                                                   .satisfies( cover -> {
                                                       assertThat( cover.getTitle() ).isEqualTo( "Тёмный лес" );
                                                       assertThat( cover.isHasCover() ).isFalse();
                                                   } );
    }

    private LibraryItem item( String title ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( title );
        item.setStatus( ReadingStatus.READING );
        return item;
    }

    private User user( String username, boolean publicProfile ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        user.setRole( Role.USER );
        user.setPublicProfile( publicProfile );
        return user;
    }
}
