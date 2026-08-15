package com.library.tracker.service.account;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.service.UserService;
import com.library.tracker.storage.ObjectStorage;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
@MockitoSettings( strictness = Strictness.LENIENT )
class AccountDeletionServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private LibraryItemRepository libraryItemRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private ObjectStorage objectStorage;

    @Mock
    private UserService userService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AccountDeletionService service;

    private User user;

    @BeforeEach
    void setUp() {
        service = new AccountDeletionService( userRepository, libraryItemRepository, sessionRepository,
                                              objectStorage, userService, passwordEncoder );

        user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "reader" );
        user.setPassword( "$2a$10$hash" );
        user.setRole( Role.USER );

        when( userService.getCurrentUser() ).thenReturn( user );
        when( passwordEncoder.matches( eq( "correct" ), eq( "$2a$10$hash" ) ) ).thenReturn( true );
        when( libraryItemRepository.findCoverKeysByOwner( any() ) ).thenReturn( List.of() );
    }

    /** Открытая сессия — это и чужой ноутбук: без пароля удаление в один клик стирает чужое. */
    @Test
    void rejectsWrongPassword() {
        assertThatThrownBy( () -> service.deleteCurrentAccount( "wrong" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Неверный пароль" );

        verify( userRepository, never() ).delete( any() );
    }

    @Test
    void rejectsEmptyPassword() {
        assertThatThrownBy( () -> service.deleteCurrentAccount( "  " ) )
                .isInstanceOf( IllegalArgumentException.class );

        verify( userRepository, never() ).delete( any() );
    }

    /** Последний супер-администратор уносит с собой доступ к системе — правило общее с UserService. */
    @Test
    void refusesToDeleteLastSuperAdmin() {
        user.setRole( Role.SUPER_ADMIN );
        doThrow( new IllegalStateException( "Должен остаться хотя бы один супер админ" ) )
                .when( userService ).ensureAnotherSuperAdminExists( eq( user.getId() ) );

        assertThatThrownBy( () -> service.deleteCurrentAccount( "correct" ) )
                .isInstanceOf( IllegalStateException.class );

        verify( userRepository, never() ).delete( any() );
        verify( objectStorage, never() ).delete( any() );
    }

    /**
     * Проверка на последнего супер-администратора спрашивается только у супер-администратора.
     * Сама она считает их в базе и срабатывает, когда меньше двух, — вызванная безусловно, она
     * запрещала бы удаление всем подряд на базе, где супер-администратора нет вовсе.
     */
    @Test
    void doesNotAskAboutSuperAdminsWhenDeletingOrdinaryUser() {
        service.deleteCurrentAccount( "correct" );

        verify( userService, never() ).ensureAnotherSuperAdminExists( any() );
        verify( userRepository ).delete( eq( user ) );
    }

    /** Супер-администратор, который не последний, уходит как все. */
    @Test
    void deletesSuperAdminWhenAnotherOneRemains() {
        user.setRole( Role.SUPER_ADMIN );

        service.deleteCurrentAccount( "correct" );

        verify( userService ).ensureAnotherSuperAdminExists( eq( user.getId() ) );
        verify( userRepository ).delete( eq( user ) );
    }

    /**
     * Обложки лежат в объектном хранилище, куда каскад БД не достаёт, и удалять их надо до записи:
     * после удаления карточек ключи потеряны, и файлы остались бы в хранилище навсегда.
     */
    @Test
    void removesCoversBeforeTheAccountItself() {
        when( libraryItemRepository.findCoverKeysByOwner( eq( user.getId() ) ) )
                .thenReturn( List.of( "covers/one.jpg", "covers/two.jpg" ) );

        service.deleteCurrentAccount( "correct" );

        InOrder order = inOrder( objectStorage, sessionRepository, userRepository, userService );
        order.verify( objectStorage ).delete( "covers/one.jpg" );
        order.verify( objectStorage ).delete( "covers/two.jpg" );
        order.verify( sessionRepository ).deleteAllByUserId( eq( user.getId() ) );
        order.verify( userRepository ).delete( eq( user ) );
        order.verify( userService ).evictFromCache( eq( user ) );
    }

    /** Недоступное хранилище не должно оставлять аккаунт неудаляемым. */
    @Test
    void survivesStorageFailure() {
        when( libraryItemRepository.findCoverKeysByOwner( any() ) ).thenReturn( List.of( "covers/one.jpg" ) );
        doThrow( new RuntimeException( "S3 недоступен" ) ).when( objectStorage ).delete( "covers/one.jpg" );

        service.deleteCurrentAccount( "correct" );

        verify( userRepository ).delete( eq( user ) );
    }

    /**
     * У UserService кеш на полминуты: без сброса удалённый пользователь ещё столько же проходит
     * аутентификацию по уже выданному токену.
     */
    @Test
    void evictsUserFromAuthenticationCache() {
        service.deleteCurrentAccount( "correct" );

        verify( userService ).evictFromCache( eq( user ) );
    }
}
