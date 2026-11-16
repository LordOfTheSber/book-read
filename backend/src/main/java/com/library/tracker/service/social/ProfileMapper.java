package com.library.tracker.service.social;

import com.library.tracker.domain.User;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.web.dto.ProfileSummaryResponse;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Сборка короткой карточки пользователя. Вынесена отдельно, потому что нужна и ленте, и профилю,
 * и комментариям: у каждого списка одна и та же пара вопросов — как человека зовут и подписан ли
 * я на него. Множество подписок берётся один раз на список, а не по запросу на строку.
 */
@Component
@RequiredArgsConstructor
public class ProfileMapper {

    private final UserFollowRepository userFollowRepository;

    @Transactional( readOnly = true )
    public Set<UUID> followedIds( User currentUser ) {
        if ( currentUser == null ) {
            return Set.of();
        }
        return new HashSet<>( userFollowRepository.findFolloweeIds( currentUser.getId() ) );
    }

    public ProfileSummaryResponse toSummary( User user, Set<UUID> followedIds ) {
        if ( user == null ) {
            return null;
        }
        return ProfileSummaryResponse.builder()
                                     .id( user.getId() )
                                     .username( user.getUsername() )
                                     .displayName( user.getDisplayName() )
                                     .hasAvatar( user.getAvatar() != null )
                                     .publicProfile( user.isPublicProfile() )
                                     .followedByMe( followedIds.contains( user.getId() ) )
                                     .build();
    }

    public List<ProfileSummaryResponse> toSummaries( List<User> users, Set<UUID> followedIds ) {
        return users.stream().map( user -> toSummary( user, followedIds ) ).toList();
    }
}
