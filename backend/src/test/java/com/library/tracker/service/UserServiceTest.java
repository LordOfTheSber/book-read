package com.library.tracker.service;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.security.AppUserDetails;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService( userRepository, sessionRepository, passwordEncoder );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void registerRejectsBlankUsernames() {
        assertThatThrownBy( () -> userService.register( " ", "password" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Username cannot be blank" );
    }

    @Test
    void registerRejectsExistingUsername() {
        when( userRepository.existsByUsernameIgnoreCase( eq( "alex" ) ) ).thenReturn( true );

        assertThatThrownBy( () -> userService.register( "alex", "password" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Username already exists" );
    }

    @Test
    void registerFirstUserBecomesSuperAdmin() {
        when( userRepository.existsByUsernameIgnoreCase( eq( "alex" ) ) ).thenReturn( false );
        when( userRepository.count() ).thenReturn( 0L );
        when( passwordEncoder.encode( eq( "secret" ) ) ).thenReturn( "encoded" );
        when( userRepository.save( any( User.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        User user = userService.register( "alex", "secret" );

        assertThat( user.getRole() ).isEqualTo( Role.SUPER_ADMIN );
        assertThat( user.getPassword() ).isEqualTo( "encoded" );
    }

    @Test
    void updateRoleRequiresSuperAdmin() {
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setUsername( "admin" );
        currentUser.setRole( Role.ADMIN );

        setAuthentication( currentUser );
        when( userRepository.findByUsernameIgnoreCase( eq( "admin" ) ) ).thenReturn( Optional.of( currentUser ) );

        assertThatThrownBy( () -> userService.updateRole( UUID.randomUUID(), Role.USER ) )
                .isInstanceOf( AccessDeniedException.class )
                .hasMessageContaining( "Only super admins can update roles" );
    }

    @Test
    void updateRolePreventsRemovingLastSuperAdmin() {
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setUsername( "root" );
        currentUser.setRole( Role.SUPER_ADMIN );

        User targetUser = new User();
        targetUser.setId( UUID.randomUUID() );
        targetUser.setUsername( "target" );
        targetUser.setRole( Role.SUPER_ADMIN );

        setAuthentication( currentUser );
        when( userRepository.findByUsernameIgnoreCase( eq( "root" ) ) ).thenReturn( Optional.of( currentUser ) );
        when( userRepository.findById( eq( targetUser.getId() ) ) ).thenReturn( Optional.of( targetUser ) );
        when( userRepository.countByRole( eq( Role.SUPER_ADMIN ) ) ).thenReturn( 1L );

        assertThatThrownBy( () -> userService.updateRole( targetUser.getId(), Role.ADMIN ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Должен остаться хотя бы один супер админ" );
    }

    @Test
    void updateBlockedStatusRejectsSelfBlock() {
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setUsername( "root" );
        currentUser.setRole( Role.SUPER_ADMIN );

        setAuthentication( currentUser );
        when( userRepository.findByUsernameIgnoreCase( eq( "root" ) ) ).thenReturn( Optional.of( currentUser ) );

        assertThatThrownBy( () -> userService.updateBlockedStatus( currentUser.getId(), true ) )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "Нельзя заблокировать самого себя" );
    }

    @Test
    void updateCurrentUserAvatarValidatesContentType() {
        MockMultipartFile file = new MockMultipartFile(
                "avatar",
                "avatar.txt",
                "text/plain",
                "data".getBytes( StandardCharsets.UTF_8 )
        );

        assertThatThrownBy( () -> userService.updateCurrentUserAvatar( file ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Unsupported avatar format" );
    }

    @Test
    void updateBlockedStatusClearsSessionsForBlockedUser() {
        User currentUser = new User();
        currentUser.setId( UUID.randomUUID() );
        currentUser.setUsername( "root" );
        currentUser.setRole( Role.SUPER_ADMIN );

        User targetUser = new User();
        targetUser.setId( UUID.randomUUID() );
        targetUser.setUsername( "target" );
        targetUser.setRole( Role.USER );

        setAuthentication( currentUser );
        when( userRepository.findByUsernameIgnoreCase( eq( "root" ) ) ).thenReturn( Optional.of( currentUser ) );
        when( userRepository.findById( eq( targetUser.getId() ) ) ).thenReturn( Optional.of( targetUser ) );
        when( userRepository.save( any( User.class ) ) ).thenAnswer( invocation -> invocation.getArgument( 0 ) );

        userService.updateBlockedStatus( targetUser.getId(), true );

        verify( sessionRepository ).deleteAllByUserId( eq( targetUser.getId() ) );
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass( User.class );
        verify( userRepository ).save( captor.capture() );
        assertThat( captor.getValue().isBlocked() ).isTrue();
    }

    /** Фильтр грузит пользователя на каждом запросе — повторные обращения не должны идти в БД. */
    @Test
    void loadUserByUsernameServesRepeatedCallsFromCache() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "alex" );
        user.setPassword( "hash" );
        user.setRole( Role.USER );
        when( userRepository.findByUsernameIgnoreCase( eq( "alex" ) ) ).thenReturn( Optional.of( user ) );

        assertThat( userService.loadUserByUsername( "alex" ).getUsername() ).isEqualTo( "alex" );
        assertThat( userService.loadUserByUsername( "alex" ).getUsername() ).isEqualTo( "alex" );
        // Регистр в ключе не должен плодить отдельные записи.
        assertThat( userService.loadUserByUsername( "ALEX" ).getUsername() ).isEqualTo( "alex" );

        verify( userRepository, times( 1 ) ).findByUsernameIgnoreCase( eq( "alex" ) );
    }

    /** Блокировка должна действовать сразу, а не по истечении TTL кэша. */
    @Test
    void evictFromCacheForcesReload() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "alex" );
        user.setPassword( "hash" );
        user.setRole( Role.USER );
        when( userRepository.findByUsernameIgnoreCase( eq( "alex" ) ) ).thenReturn( Optional.of( user ) );

        assertThat( userService.loadUserByUsername( "alex" ).isAccountNonLocked() ).isTrue();

        user.setBlocked( true );
        userService.evictFromCache( user );

        assertThat( userService.loadUserByUsername( "alex" ).isAccountNonLocked() ).isFalse();
        verify( userRepository, times( 2 ) ).findByUsernameIgnoreCase( eq( "alex" ) );
    }

    private void setAuthentication( User user ) {
        AppUserDetails userDetails = AppUserDetails.builder()
                                                   .id( user.getId() )
                                                   .username( user.getUsername() )
                                                   .password( "secret" )
                                                   .role( user.getRole() )
                                                   .blocked( user.isBlocked() )
                                                   .build();
        var authentication = new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication( authentication );
    }
}
