package com.library.tracker.service.social;

import com.library.tracker.domain.ActivityEvent;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Shelf;
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
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Лента активности. События пишутся в момент, когда что-то произошло, а не собираются запросом
 * по текущему состоянию библиотеки: запись «дочитал» должна остаться в ленте, даже если книгу
 * потом вернули в «читаю» или переоценили.
 * <p>
 * Читается лента с фильтром по открытости профиля, а не по открытости на момент записи: закрыв
 * профиль, человек убирает из чужих лент и то, что успел написать раньше.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ActivityService {

    /** Столько событий влезает в ленту, не требуя подгрузки и не превращая её в архив. */
    private static final int DEFAULT_LIMIT = 50;

    private static final int MAX_LIMIT = 200;

    /** Окно сводки «обсуждают на этой неделе»: ровно неделя, а не «последние N событий». */
    private static final int TRENDING_WINDOW_DAYS = 7;

    /** Больше пяти книг сбоку — это уже второй список, а не подсказка. */
    private static final int TRENDING_LIMIT = 5;

    private final ActivityEventRepository activityEventRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserFollowRepository userFollowRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ProfileMapper profileMapper;
    private final PublicReviewMapper publicReviewMapper;
    private final ReviewAccess reviewAccess;
    private final Clock clock;

    public void record( User actor, ActivityType type, LibraryItem item, Shelf shelf, String subject, String detail ) {
        if ( actor == null ) {
            return;
        }
        ActivityEvent event = new ActivityEvent();
        event.setActor( actor );
        event.setType( type );
        event.setItem( item );
        event.setShelf( shelf );
        event.setSubject( truncate( subject ) );
        event.setDetail( truncate( detail ) );
        activityEventRepository.save( event );
    }

    /** Лента подписок вместе со своими событиями: пустая лента у нового пользователя бесполезна. */
    @Transactional( readOnly = true )
    public List<ActivityResponse> feed( Integer limit ) {
        User currentUser = userService.getCurrentUser();
        List<UUID> followeeIds = userFollowRepository.findFolloweeIds( currentUser.getId() );

        Set<UUID> actorIds = new LinkedHashSet<>( visibleActorIds( followeeIds ) );
        actorIds.add( currentUser.getId() );

        List<ActivityEvent> events = activityEventRepository.findByActorIdInOrderByCreatedAtDesc(
                actorIds, PageRequest.of( 0, normalizeLimit( limit ) ) );
        return toResponses( events, currentUser );
    }

    /**
     * О чём пишут и спорят вокруг спрашивающего за неделю. Область та же, что у ленты: сводка
     * отвечает «что обсуждают у меня в подписках», и книга из закрытого профиля в неё не попадает
     * ни своим отзывом, ни чужим комментарием.
     */
    @Transactional( readOnly = true )
    public List<TrendingBookResponse> trending() {
        User currentUser = userService.getCurrentUser();
        Set<UUID> actorIds = new LinkedHashSet<>( visibleActorIds(
                userFollowRepository.findFolloweeIds( currentUser.getId() ) ) );
        actorIds.add( currentUser.getId() );

        LocalDateTime since = LocalDateTime.now( clock ).minusDays( TRENDING_WINDOW_DAYS );
        Map<UUID, Long> reviews = activityEventRepository.countReviewsSince( actorIds, since ).stream()
                                                         .collect( Collectors.toMap(
                                                                 ActivityEventRepository.ItemCount::getItemId,
                                                                 ActivityEventRepository.ItemCount::getCount ) );
        Map<UUID, Long> comments = reviewCommentRepository.countSince( actorIds, since ).stream()
                                                          .collect( Collectors.toMap(
                                                                  ReviewCommentRepository.ItemCount::getItemId,
                                                                  ReviewCommentRepository.ItemCount::getCount ) );

        Set<UUID> itemIds = new LinkedHashSet<>( reviews.keySet() );
        itemIds.addAll( comments.keySet() );
        if ( itemIds.isEmpty() ) {
            return List.of();
        }

        return libraryItemRepository.findAllWithAuthors( itemIds ).stream()
                                    .filter( item -> reviewAccess.canSee( item, currentUser ) )
                                    .map( item -> TrendingBookResponse.builder()
                                                                      .itemId( item.getId() )
                                                                      .kind( item.getKind() )
                                                                      .title( item.getTitle() )
                                                                      .hasCover( item.getCoverKey() != null )
                                                                      .reviewCount( reviews.getOrDefault(
                                                                              item.getId(), 0L ) )
                                                                      .commentCount( comments.getOrDefault(
                                                                              item.getId(), 0L ) )
                                                                      .build() )
                                    // Сначала то, что и написали, и обсудили: один отзыв без
                                    // единого ответа — ещё не обсуждение.
                                    .sorted( Comparator
                                                     .comparingLong( ( TrendingBookResponse book ) ->
                                                                             book.getReviewCount()
                                                                                     + book.getCommentCount() )
                                                     .reversed()
                                                     .thenComparing( TrendingBookResponse::getTitle,
                                                                     String.CASE_INSENSITIVE_ORDER ) )
                                    .limit( TRENDING_LIMIT )
                                    .toList();
    }

    /** События одного человека — для его профиля. Видимость профиля проверяется вызывающим. */
    @Transactional( readOnly = true )
    public List<ActivityResponse> byUser( User actor, Integer limit ) {
        List<ActivityEvent> events = activityEventRepository.findByActorIdOrderByCreatedAtDesc(
                actor.getId(), PageRequest.of( 0, normalizeLimit( limit ) ) );
        return toResponses( events, userService.getCurrentUser() );
    }

    /**
     * Закрытый профиль выпадает из ленты целиком. Отфильтровать после выборки нельзя: срез уже
     * ограничен количеством, и лента из закрытых профилей приходила бы наполовину пустой.
     */
    private List<UUID> visibleActorIds( List<UUID> followeeIds ) {
        return followeeIds.isEmpty() ? List.of() : userRepository.findPublicProfileIds( followeeIds );
    }

    private List<ActivityResponse> toResponses( List<ActivityEvent> events, User currentUser ) {
        Set<UUID> followed = profileMapper.followedIds( currentUser );
        Map<UUID, PublicReviewResponse> reviews = reviewsOf( events, currentUser );
        List<ActivityResponse> responses = new ArrayList<>( events.size() );
        for ( ActivityEvent event : events ) {
            UUID itemId = event.getItem() != null ? event.getItem().getId() : null;
            responses.add( ActivityResponse.builder()
                                           .id( event.getId() )
                                           .type( event.getType() )
                                           .actor( profileMapper.toSummary( event.getActor(), followed ) )
                                           .itemId( itemId )
                                           .shelfId( event.getShelf() != null ? event.getShelf().getId() : null )
                                           .subject( event.getSubject() )
                                           .detail( event.getDetail() )
                                           .createdAt( toOffsetDateTime( event.getCreatedAt() ) )
                                           .review( event.getType() == ActivityType.PUBLISHED_REVIEW && itemId != null
                                                            ? reviews.get( itemId )
                                                            : null )
                                           .build() );
        }
        return responses;
    }

    /**
     * Отзывы событий «написал отзыв» — одной выборкой на всю ленту. Видимость проверяется на
     * каждой записи отдельно: открытость профиля автора события ещё не значит, что текст можно
     * показать, — отзыв мог быть удалён, а карточка убрана с открытых полок.
     */
    private Map<UUID, PublicReviewResponse> reviewsOf( List<ActivityEvent> events, User currentUser ) {
        Set<UUID> itemIds = new LinkedHashSet<>();
        for ( ActivityEvent event : events ) {
            if ( event.getType() == ActivityType.PUBLISHED_REVIEW && event.getItem() != null ) {
                itemIds.add( event.getItem().getId() );
            }
        }
        if ( itemIds.isEmpty() ) {
            return Map.of();
        }

        List<LibraryItem> visible = libraryItemRepository.findAllWithAuthors( itemIds ).stream()
                                                         .filter( item -> reviewAccess.canSee( item, currentUser ) )
                                                         .toList();
        Map<UUID, PublicReviewResponse> byItem = new HashMap<>();
        for ( PublicReviewResponse review : publicReviewMapper.toResponses( visible ) ) {
            byItem.put( review.getItemId(), review );
        }
        return byItem;
    }

    private int normalizeLimit( Integer limit ) {
        if ( limit == null || limit <= 0 ) {
            return DEFAULT_LIMIT;
        }
        return Math.min( limit, MAX_LIMIT );
    }

    private String truncate( String value ) {
        if ( value == null ) {
            return null;
        }
        return value.length() <= 512 ? value : value.substring( 0, 512 );
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
