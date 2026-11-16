package com.library.tracker.service.account;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.TrustedDeviceRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class PasswordChangeServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private TrustedDeviceRepository trustedDeviceRepository;

    @Mock
    private UserService userService;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private PasswordChangeService service;

    private User user;

    @BeforeEach
    void setUp() {
        service = new PasswordChangeService( userRepository, sessionRepository, trustedDeviceRepository, userService,
                                             encoder );
        user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "reader" );
        user.setRole( Role.USER );
        user.setPassword( encoder.encode( "secret123" ) );
    }

    /**
     * Пароль меняют, когда старый мог утечь: оставить по нему открытые сессии и запомненные
     * устройства значит не сделать того, ради чего его и меняли.
     */
    @Test
    void changeResetsSessionsAndDevices() {
        when( userService.getCurrentUser() ).thenReturn( user );

        service.changeOwnPassword( "secret123", "newsecret1" );

        assertThat( encoder.matches( "newsecret1", user.getPassword() ) ).isTrue();
        verify( userRepository ).save( user );
        verify( userService ).evictFromCache( user );
        verify( sessionRepository ).deleteAllByUserId( user.getId() );
        verify( trustedDeviceRepository ).deleteAllByUserId( user.getId() );
    }

    /** Открытая сессия — это и чужой ноутбук: без текущего пароля пароль не меняется. */
    @Test
    void wrongCurrentPasswordIsRejected() {
        when( userService.getCurrentUser() ).thenReturn( user );

        assertThatThrownBy( () -> service.changeOwnPassword( "notmine1", "newsecret1" ) )
                .isInstanceOf( IllegalArgumentException.class );
        verify( userRepository, never() ).save( any( User.class ) );
        verify( sessionRepository, never() ).deleteAllByUserId( any() );
    }

    /** Смена пароля на тот же — не смена: она выкинула бы человека из сессий ни за чем. */
    @Test
    void samePasswordIsRejected() {
        when( userService.getCurrentUser() ).thenReturn( user );

        assertThatThrownBy( () -> service.changeOwnPassword( "secret123", "secret123" ) )
                .isInstanceOf( IllegalArgumentException.class );
        verify( userRepository, never() ).save( any( User.class ) );
    }
}
