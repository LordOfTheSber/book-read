package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.User;
import com.library.tracker.domain.UserFollow;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.UserAchievementRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.service.engagement.StreakService;
import com.library.tracker.web.dto.ActivityResponse;
import com.library.tracker.web.dto.ProfileSummaryResponse;
import com.library.tracker.web.dto.ProfileUpdateRequest;
import com.library.tracker.web.dto.PublicProfileResponse;
import com.library.tracker.web.dto.PublicReviewResponse;
import com.library.tracker.web.dto.ShelfResponse;
import com.library.tracker.web.dto.ShowcaseItemResponse;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Публичные профили и подписки. Профиль закрыт по умолчанию и открывается решением владельца:
 * это первая точка, где данные одного пользователя видит другой, и включаться она должна явно.
 * <p>
 * «Публичный» здесь по-прежнему означает «видимый другим пользователям сервиса», а не всему
 * интернету — анонимный доступ не открывается ни к одной из точек ниже.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ProfileService {

    /** Столько отзывов показывается в профиле: дальше это уже не профиль, а лента. */
    private static final int PROFILE_REVIEW_LIMIT = 10;

    private static final int SEARCH_LIMIT = 20;

    /** Столько обложек «сейчас читает» помещается в колонку чужого профиля. */
    private static final int READING_SHOWN = 4;

    private final UserRepository userRepository;
    private final UserFollowRepository userFollowRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final ShelfRepository shelfRepository;
    private final UserService userService;
    private final ProfileMapper profileMapper;
    private final ActivityService activityService;
    private final PublicReviewMapper publicReviewMapper;
    private final StreakService streakService;

    @Transactional( readOnly = true )
    public Optional<PublicProfileResponse> findByUsername( String username ) {
        User currentUser = userService.getCurrentUser();
        return userRepository.findByUsernameIgnoreCase( username )
                             .filter( user -> isVisible( user, currentUser ) )
                             .map( user -> toProfile( user, currentUser ) );
    }

    /** Своя страница настроек профиля: открыта владельцу всегда, даже пока профиль закрыт. */
    @Transactional( readOnly = true )
    public PublicProfileResponse me() {
        User currentUser = userService.getCurrentUser();
        return toProfile( currentUser, currentUser );
    }

    public PublicProfileResponse updateMyProfile( ProfileUpdateRequest request ) {
        User currentUser = userService.getCurrentUser();
        currentUser.setDisplayName( trimToNull( request.getDisplayName() ) );
        currentUser.setBio( trimToNull( request.getBio() ) );
        currentUser.setPublicProfile( request.isPublicProfile() );
        User saved = userRepository.save( currentUser );
        // Роль и блокировка в кэше учётных данных те же, но профиль читается из той же записи.
        userService.evictFromCache( saved );
        return toProfile( saved, saved );
    }

    /**
     * Подписка односторонняя и без подтверждения: подписаться можно только на открытый профиль,
     * а его владелец уже согласился показывать содержимое любому пользователю сервиса.
     */
    public PublicProfileResponse follow( String username ) {
        User currentUser = userService.getCurrentUser();
        User target = requireVisible( username, currentUser );

        if ( target.getId().equals( currentUser.getId() ) ) {
            throw new IllegalArgumentException( "Подписка на себя ничего не добавляет" );
        }
        if ( !target.isPublicProfile() ) {
            throw new IllegalArgumentException( "Профиль закрыт" );
        }
        if ( !userFollowRepository.existsByFollowerIdAndFolloweeId( currentUser.getId(), target.getId() ) ) {
            UserFollow follow = new UserFollow();
            follow.setFollower( currentUser );
            follow.setFollowee( target );
            userFollowRepository.save( follow );
        }
        return toProfile( target, currentUser );
    }

    public PublicProfileResponse unfollow( String username ) {
        User currentUser = userService.getCurrentUser();
        User target = requireVisible( username, currentUser );
        userFollowRepository.findByFollowerIdAndFolloweeId( currentUser.getId(), target.getId() )
                            .ifPresent( userFollowRepository::delete );
        return toProfile( target, currentUser );
    }

    @Transactional( readOnly = true )
    public Optional<List<ProfileSummaryResponse>> followers( String username ) {
        User currentUser = userService.getCurrentUser();
        return userRepository.findByUsernameIgnoreCase( username )
                             .filter( user -> isVisible( user, currentUser ) )
                             .map( user -> {
                                 Set<UUID> followed = profileMapper.followedIds( currentUser );
                                 return userFollowRepository.findByFolloweeIdOrderByCreatedAtDesc( user.getId() )
                                                            .stream()
                                                            .map( follow -> profileMapper.toSummary(
                                                                    follow.getFollower(), followed ) )
                                                            .toList();
                             } );
    }

    @Transactional( readOnly = true )
    public Optional<List<ProfileSummaryResponse>> following( String username ) {
        User currentUser = userService.getCurrentUser();
        return userRepository.findByUsernameIgnoreCase( username )
                             .filter( user -> isVisible( user, currentUser ) )
                             .map( user -> {
                                 Set<UUID> followed = profileMapper.followedIds( currentUser );
                                 return userFollowRepository.findByFollowerIdOrderByCreatedAtDesc( user.getId() )
                                                            .stream()
                                                            .map( follow -> profileMapper.toSummary(
                                                                    follow.getFollowee(), followed ) )
                                                            .toList();
                             } );
    }

    /** Поиск людей: только открытые профили — на закрытый всё равно не подписаться. */
    @Transactional( readOnly = true )
    public List<ProfileSummaryResponse> search( String query ) {
        if ( !StringUtils.hasText( query ) ) {
            return List.of();
        }
        User currentUser = userService.getCurrentUser();
        Set<UUID> followed = profileMapper.followedIds( currentUser );
        return userRepository.searchPublicProfiles( query.trim(), PageRequest.of( 0, SEARCH_LIMIT ) )
                             .stream()
                             .filter( user -> !user.getId().equals( currentUser.getId() ) )
                             .map( user -> profileMapper.toSummary( user, followed ) )
                             .toList();
    }

    /** Лента одного человека: доступ тот же, что у профиля. */
    @Transactional( readOnly = true )
    public Optional<List<ActivityResponse>> activity( String username, Integer limit ) {
        User currentUser = userService.getCurrentUser();
        return userRepository.findByUsernameIgnoreCase( username )
                             .filter( user -> isVisible( user, currentUser ) )
                             .map( user -> activityService.byUser( user, limit ) );
    }

    @Transactional( readOnly = true )
    public boolean isVisible( User user, User currentUser ) {
        return user.isPublicProfile()
               || user.getId().equals( currentUser.getId() )
               || userService.isAdmin( currentUser );
    }

    private User requireVisible( String username, User currentUser ) {
        return userRepository.findByUsernameIgnoreCase( username )
                             .filter( user -> isVisible( user, currentUser ) )
                             .orElseThrow( () -> new IllegalArgumentException( "Профиль не найден" ) );
    }

    private PublicProfileResponse toProfile( User user, User currentUser ) {
        boolean me = user.getId().equals( currentUser.getId() );
        Double average = libraryItemRepository.averageRating( user.getId() );

        List<LibraryItem> reviewed =
                libraryItemRepository.findReviewed( user.getId(), PageRequest.of( 0, PROFILE_REVIEW_LIMIT ) );
        // В своём профиле отметка «есть у вас» стоит у каждой строки и не значит ничего.
        List<PublicReviewResponse> reviews = me
                ? publicReviewMapper.toResponses( reviewed )
                : publicReviewMapper.toResponses( reviewed, ownedTitles( reviewed, currentUser ) );

        return PublicProfileResponse.builder()
                                    .id( user.getId() )
                                    .username( user.getUsername() )
                                    .displayName( user.getDisplayName() )
                                    .bio( user.getBio() )
                                    .hasAvatar( user.getAvatar() != null )
                                    .publicProfile( user.isPublicProfile() )
                                    .me( me )
                                    .followedByMe( !me && userFollowRepository.existsByFollowerIdAndFolloweeId(
                                            currentUser.getId(), user.getId() ) )
                                    .followerCount( userFollowRepository.countByFolloweeId( user.getId() ) )
                                    .followingCount( userFollowRepository.countByFollowerId( user.getId() ) )
                                    .finishedCount( libraryItemRepository.countFinishedBetween(
                                            user.getId(), StreakService.EPOCH, StreakService.FAR_FUTURE ) )
                                    .reviewCount( libraryItemRepository.countReviews( user.getId() ) )
                                    .averageRating( average != null ? BigDecimal.valueOf( average ) : null )
                                    .currentStreak( streakService.currentStreak( user.getId() ) )
                                    .achievementCount( userAchievementRepository
                                                               .findByOwnerIdOrderByUnlockedOnAsc( user.getId() )
                                                               .size() )
                                    .joinedAt( toOffsetDateTime( user.getCreatedAt() ) )
                                    .commonCount( me ? 0
                                                     : libraryItemRepository.countCommonTitles( currentUser.getId(),
                                                                                                user.getId() ) )
                                    .shelves( shelves( user, me ) )
                                    .reviews( reviews )
                                    .currentlyReading( currentlyReading( user ) )
                                    .build();
    }

    /**
     * Названия отзывов, которые уже есть у спрашивающего, — одним запросом на весь список.
     * По запросу на отзыв страница чужого профиля стоила бы десяти лишних обращений к базе.
     */
    private Set<String> ownedTitles( List<LibraryItem> reviewed, User currentUser ) {
        if ( reviewed.isEmpty() ) {
            return Set.of();
        }
        Set<String> titles = reviewed.stream()
                                     .map( item -> PublicReviewMapper.normalizeTitle( item.getTitle() ) )
                                     .filter( StringUtils::hasText )
                                     .collect( Collectors.toSet() );
        return titles.isEmpty()
                ? Set.of()
                : Set.copyOf( libraryItemRepository.findOwnedTitles( titles, currentUser.getId() ) );
    }

    /**
     * «Сейчас читает» — обложками и без прогресса: чужой темп чтения не наше дело, а вот
     * что человек держит в руках прямо сейчас — самое живое, что есть на его странице.
     */
    private List<ShowcaseItemResponse> currentlyReading( User user ) {
        return libraryItemRepository.findReadingNow( user.getId(), PageRequest.of( 0, READING_SHOWN ) ).stream()
                                    .map( item -> ShowcaseItemResponse.builder()
                                                                      .id( item.getId() )
                                                                      .title( item.getTitle() )
                                                                      .kind( item.getKind() )
                                                                      .status( item.getStatus() )
                                                                      .hasCover( item.getCoverKey() != null )
                                                                      .build() )
                                    .toList();
    }

    /**
     * В чужом профиле — только открытые полки. Своему владельцу показываются все: профиль
     * заодно служит предпросмотром того, что увидят остальные, и прятать от него половину полок
     * значит прятать сам смысл настройки.
     */
    private List<ShelfResponse> shelves( User user, boolean me ) {
        List<Shelf> shelves = shelfRepository.findByOwnerIdOrderByNameAsc( user.getId() );
        // Счётчики состава — одним запросом на все полки владельца: по запросу на полку профиль
        // человека с двумя десятками полок стоил бы двух десятков лишних обращений к базе.
        Map<UUID, Long> counts = shelfRepository.countItemsByShelf( user.getId() ).stream()
                                                .collect( Collectors.toMap( ShelfRepository.ShelfCount::getShelfId,
                                                                            ShelfRepository.ShelfCount::getCount ) );
        return shelves.stream()
                      .filter( shelf -> me || shelf.isPublic() )
                      .sorted( Comparator.comparing( Shelf::getName, String.CASE_INSENSITIVE_ORDER ) )
                      .map( shelf -> ShelfResponse.builder()
                                                  .id( shelf.getId() )
                                                  .name( shelf.getName() )
                                                  .description( shelf.getDescription() )
                                                  .isPublic( shelf.isPublic() )
                                                  .itemCount( counts.getOrDefault( shelf.getId(), 0L ) )
                                                  .ownerId( user.getId() )
                                                  .ownerUsername( user.getUsername() )
                                                  .owned( me )
                                                  .createdAt( toOffsetDateTime( shelf.getCreatedAt() ) )
                                                  .updatedAt( toOffsetDateTime( shelf.getUpdatedAt() ) )
                                                  .build() )
                      .toList();
    }

    private String trimToNull( String value ) {
        return StringUtils.hasText( value ) ? value.trim() : null;
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
