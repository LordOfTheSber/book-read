package com.library.tracker.service.account;

import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.domain.User;
import com.library.tracker.service.UserService;
import com.library.tracker.storage.ObjectStorage;

import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Удаление собственного аккаунта. Операция необратимая, поэтому порядок шагов здесь важнее
 * краткости.
 * <p>
 * Пароль спрашивается заново не из формальности: открытая сессия — это чужой ноутбук, оставленный
 * разблокированным, и удаление в один клик из неё стирает чужую библиотеку.
 * <p>
 * Обложки удаляются до записи в БД. Они лежат в объектном хранилище, куда каскад внешнего ключа
 * не достаёт: если сначала снести пользователя, ключи потеряются вместе с карточками, и файлы
 * останутся в хранилище навсегда — найти их будет уже не по чему.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final SessionRepository sessionRepository;
    private final ObjectStorage objectStorage;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void deleteCurrentAccount( String password ) {
        User user = userService.getCurrentUser();

        if ( !StringUtils.hasText( password ) || !passwordEncoder.matches( password, user.getPassword() ) ) {
            throw new IllegalArgumentException( "Неверный пароль" );
        }
        // Последний супер-администратор уносит с собой доступ к системе. Правило то же, что
        // у разжалования и блокировки, поэтому и проверка та же.
        userService.ensureAnotherSuperAdminExists( user.getId() );

        List<String> coverKeys = libraryItemRepository.findCoverKeysByOwner( user.getId() );
        coverKeys.forEach( key -> {
            try {
                objectStorage.delete( key );
            } catch ( RuntimeException ex ) {
                // Недоступное хранилище не должно оставлять аккаунт неудаляемым: осиротевший файл
                // — меньшее зло, чем «удалите меня» с ошибкой при каждой попытке.
                log.warn( "Не удалось удалить обложку {} при удалении аккаунта", key, ex );
            }
        } );

        // Сессии и библиотеку уносит каскад из V18; явное удаление сессий здесь — не дубль,
        // а гарантия, что живых ключей не останется, даже если каскад однажды снимут.
        sessionRepository.deleteAllByUserId( user.getId() );
        userRepository.delete( user );

        // У UserService свой кеш на полминуты: без сброса удалённый пользователь ещё столько же
        // проходит аутентификацию по уже выданному токену.
        userService.evictFromCache( user );
        log.info( "Аккаунт {} удалён вместе с {} обложками", user.getUsername(), coverKeys.size() );
    }
}
