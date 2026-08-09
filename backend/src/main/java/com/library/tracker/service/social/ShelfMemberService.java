package com.library.tracker.service.social;

import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.ShelfAccess;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ShelfMemberRequest;
import com.library.tracker.web.dto.ShelfMemberResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Совместные полки: семейная полка, книжный клуб. Список участников ведут владелец и кураторы;
 * уйти с полки участник может сам — иначе выход из клуба требовал бы согласия клуба.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ShelfMemberService {

    private final ShelfMemberRepository shelfMemberRepository;
    private final ShelfRepository shelfRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ShelfAccess shelfAccess;
    private final ProfileMapper profileMapper;

    @Transactional( readOnly = true )
    public Optional<List<ShelfMemberResponse>> findMembers( UUID shelfId ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findById( shelfId )
                              .filter( shelf -> shelfAccess.canRead( shelf, currentUser ) )
                              .map( shelf -> {
                                  Set<UUID> followed = profileMapper.followedIds( currentUser );
                                  return shelfMemberRepository.findByShelfIdOrderByCreatedAtAsc( shelfId ).stream()
                                                              .map( member -> toResponse( member, followed ) )
                                                              .toList();
                              } );
    }

    /** Повторный вызов с другой ролью меняет роль: отдельного «изменить» не нужно. */
    public Optional<List<ShelfMemberResponse>> addOrUpdate( UUID shelfId, ShelfMemberRequest request ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findById( shelfId ).map( shelf -> {
            requireCurator( shelf, currentUser );
            User target = userRepository.findByUsernameIgnoreCase( request.getUsername().trim() )
                                        .orElseThrow( () -> new IllegalArgumentException( "Пользователь не найден" ) );
            if ( shelfAccess.isOwner( shelf, target ) ) {
                throw new IllegalArgumentException( "Владелец полки и так ею распоряжается" );
            }

            ShelfMember member = shelfMemberRepository.findByShelfIdAndUserId( shelfId, target.getId() )
                                                      .orElseGet( () -> {
                                                          ShelfMember created = new ShelfMember();
                                                          created.setShelf( shelf );
                                                          created.setUser( target );
                                                          return created;
                                                      } );
            member.setRole( request.getRole() );
            shelfMemberRepository.save( member );
            return members( shelfId, currentUser );
        } );
    }

    public Optional<List<ShelfMemberResponse>> remove( UUID shelfId, UUID userId ) {
        User currentUser = userService.getCurrentUser();
        return shelfRepository.findById( shelfId ).map( shelf -> {
            // Уйти с полки участник может сам: иначе выход из книжного клуба требовал бы
            // согласия того, кто его собрал.
            if ( !currentUser.getId().equals( userId ) ) {
                requireCurator( shelf, currentUser );
            }
            shelfMemberRepository.deleteByShelfIdAndUserId( shelfId, userId );
            return members( shelfId, currentUser );
        } );
    }

    private List<ShelfMemberResponse> members( UUID shelfId, User currentUser ) {
        Set<UUID> followed = profileMapper.followedIds( currentUser );
        return shelfMemberRepository.findByShelfIdOrderByCreatedAtAsc( shelfId ).stream()
                                    .map( member -> toResponse( member, followed ) )
                                    .toList();
    }

    private void requireCurator( Shelf shelf, User currentUser ) {
        if ( !shelfAccess.canCurate( shelf, currentUser ) ) {
            throw new AccessDeniedException( "Список участников ведут владелец и кураторы полки" );
        }
    }

    private ShelfMemberResponse toResponse( ShelfMember member, Set<UUID> followed ) {
        return ShelfMemberResponse.builder()
                                  .id( member.getId() )
                                  .user( profileMapper.toSummary( member.getUser(), followed ) )
                                  .role( member.getRole() )
                                  .createdAt( toOffsetDateTime( member.getCreatedAt() ) )
                                  .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
