package com.library.tracker.service.social;

import com.library.tracker.domain.ActivityEvent;
import com.library.tracker.domain.ActivityType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ActivityEventRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ActivityResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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

    private final ActivityEventRepository activityEventRepository;
    private final UserFollowRepository userFollowRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ProfileMapper profileMapper;

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
        List<ActivityResponse> responses = new ArrayList<>( events.size() );
        for ( ActivityEvent event : events ) {
            responses.add( ActivityResponse.builder()
                                           .id( event.getId() )
                                           .type( event.getType() )
                                           .actor( profileMapper.toSummary( event.getActor(), followed ) )
                                           .itemId( event.getItem() != null ? event.getItem().getId() : null )
                                           .shelfId( event.getShelf() != null ? event.getShelf().getId() : null )
                                           .subject( event.getSubject() )
                                           .detail( event.getDetail() )
                                           .createdAt( toOffsetDateTime( event.getCreatedAt() ) )
                                           .build() );
        }
        return responses;
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
