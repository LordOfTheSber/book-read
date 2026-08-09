package com.library.tracker.service.social;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.ShelfRole;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ShelfMemberRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.UserFollowRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.ShelfAccess;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.ShelfMemberRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class ShelfMemberServiceTest {

    @Mock
    private ShelfMemberRepository shelfMemberRepository;

    @Mock
    private ShelfRepository shelfRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserService userService;

    @Mock
    private UserFollowRepository userFollowRepository;

    private ShelfMemberService service;

    private User owner;

    @BeforeEach
    void setUp() {
        ShelfAccess shelfAccess = new ShelfAccess( shelfMemberRepository, userService );
        service = new ShelfMemberService( shelfMemberRepository, shelfRepository, userRepository, userService,
                                          shelfAccess, new ProfileMapper( userFollowRepository ) );
        owner = user( "owner" );
        lenient().when( userFollowRepository.findFolloweeIds( any() ) ).thenReturn( List.of() );
        lenient().when( shelfMemberRepository.findByShelfIdOrderByCreatedAtAsc( any() ) ).thenReturn( List.of() );
    }

    /** Список участников ведут владелец и кураторы — читатель полки к нему не допускается. */
    @Test
    void viewerCannotInviteAnyone() {
        User viewer = user( "viewer" );
        Shelf shelf = shelf( owner );
        when( userService.getCurrentUser() ).thenReturn( viewer );
        when( shelfRepository.findById( shelf.getId() ) ).thenReturn( Optional.of( shelf ) );
        when( shelfMemberRepository.findByShelfIdAndUserId( eq( shelf.getId() ), eq( viewer.getId() ) ) )
                .thenReturn( Optional.of( member( shelf, viewer, ShelfRole.VIEWER ) ) );

        assertThatThrownBy( () -> service.addOrUpdate( shelf.getId(), request( "guest", ShelfRole.VIEWER ) ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( shelfMemberRepository, never() ).save( any( ShelfMember.class ) );
    }

    /** Владельца в участники не зовут: он и так распоряжается полкой. */
    @Test
    void ownerCannotBeAddedAsMember() {
        Shelf shelf = shelf( owner );
        when( userService.getCurrentUser() ).thenReturn( owner );
        when( shelfRepository.findById( shelf.getId() ) ).thenReturn( Optional.of( shelf ) );
        when( userRepository.findByUsernameIgnoreCase( "owner" ) ).thenReturn( Optional.of( owner ) );

        assertThatThrownBy( () -> service.addOrUpdate( shelf.getId(), request( "owner", ShelfRole.CURATOR ) ) )
                .isInstanceOf( IllegalArgumentException.class );
    }

    /** Уйти с полки участник может сам: выход из клуба не требует согласия клуба. */
    @Test
    void memberCanLeaveWithoutCuratorRights() {
        User viewer = user( "viewer" );
        Shelf shelf = shelf( owner );
        when( userService.getCurrentUser() ).thenReturn( viewer );
        when( shelfRepository.findById( shelf.getId() ) ).thenReturn( Optional.of( shelf ) );

        service.remove( shelf.getId(), viewer.getId() );

        verify( shelfMemberRepository ).deleteByShelfIdAndUserId( shelf.getId(), viewer.getId() );
    }

    @Test
    void memberCannotRemoveSomeoneElse() {
        User viewer = user( "viewer" );
        Shelf shelf = shelf( owner );
        UUID otherId = UUID.randomUUID();
        when( userService.getCurrentUser() ).thenReturn( viewer );
        when( shelfRepository.findById( shelf.getId() ) ).thenReturn( Optional.of( shelf ) );
        when( shelfMemberRepository.findByShelfIdAndUserId( eq( shelf.getId() ), eq( viewer.getId() ) ) )
                .thenReturn( Optional.of( member( shelf, viewer, ShelfRole.CONTRIBUTOR ) ) );

        assertThatThrownBy( () -> service.remove( shelf.getId(), otherId ) )
                .isInstanceOf( AccessDeniedException.class );
        verify( shelfMemberRepository, never() ).deleteByShelfIdAndUserId( any(), any() );
    }

    private ShelfMemberRequest request( String username, ShelfRole role ) {
        ShelfMemberRequest request = new ShelfMemberRequest();
        request.setUsername( username );
        request.setRole( role );
        return request;
    }

    private ShelfMember member( Shelf shelf, User user, ShelfRole role ) {
        ShelfMember member = new ShelfMember();
        member.setId( UUID.randomUUID() );
        member.setShelf( shelf );
        member.setUser( user );
        member.setRole( role );
        return member;
    }

    private Shelf shelf( User shelfOwner ) {
        Shelf shelf = new Shelf();
        shelf.setId( UUID.randomUUID() );
        shelf.setName( "Книжный клуб" );
        shelf.setOwner( shelfOwner );
        return shelf;
    }

    private User user( String username ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        user.setRole( Role.USER );
        return user;
    }
}
