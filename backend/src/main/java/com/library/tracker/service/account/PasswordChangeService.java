package com.library.tracker.service.account;

import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.TrustedDeviceRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Смена собственного пароля.
 * <p>
 * Вместе с паролем гасятся все сессии и запомненные устройства — включая текущее. Пароль меняют
 * не от скуки: обычно потому, что старый мог утечь, и оставить по нему открытые входы значит
 * не сделать ровно того, ради чего пароль и меняли. Поэтому после смены нужно войти заново.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordChangeService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final TrustedDeviceRepository trustedDeviceRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void changeOwnPassword( String currentPassword, String newPassword ) {
        User user = userService.getCurrentUser();

        if ( !StringUtils.hasText( currentPassword ) || !passwordEncoder.matches( currentPassword,
                                                                                 user.getPassword() ) ) {
            throw new IllegalArgumentException( "Текущий пароль неверный" );
        }
        if ( passwordEncoder.matches( newPassword, user.getPassword() ) ) {
            throw new IllegalArgumentException( "Новый пароль совпадает с текущим" );
        }

        user.setPassword( passwordEncoder.encode( newPassword ) );
        userRepository.save( user );
        // Кэш учётных данных живёт в UserService: без сброса вход по старому паролю продолжал бы
        // работать до истечения записи.
        userService.evictFromCache( user );

        sessionRepository.deleteAllByUserId( user.getId() );
        trustedDeviceRepository.deleteAllByUserId( user.getId() );
        log.info( "Пароль сменён, сессии и устройства сброшены: {}", user.getUsername() );
    }
}
