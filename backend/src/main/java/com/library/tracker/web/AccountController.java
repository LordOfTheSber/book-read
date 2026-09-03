package com.library.tracker.web;

import com.library.tracker.domain.User;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.service.SessionService;
import com.library.tracker.service.UserService;
import com.library.tracker.security.DeviceTokenCookieService;
import com.library.tracker.service.account.AccountDeletionService;
import com.library.tracker.service.account.PasswordChangeService;
import com.library.tracker.service.account.UserDataExportService;
import com.library.tracker.web.dto.AccountDeletionRequest;
import com.library.tracker.web.dto.PasswordChangeRequest;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Собственные данные пользователя: забрать их и уйти.
 * <p>
 * Отдельное пространство имён, а не {@code /api/v1/exports/me}: та ветка целиком закрыта на
 * супер-администратора одним правилом в {@code SecurityConfig}, и любой пользовательский путь
 * под тем же префиксом пришлось бы ставить строкой выше — а одна перестановка правил открывала бы
 * административный бэкап всем.
 */
@RestController
@RequestMapping( "/api/v1/account" )
@RequiredArgsConstructor
public class AccountController {

    private final UserService userService;
    private final UserDataExportService userDataExportService;
    private final AccountDeletionService accountDeletionService;
    private final PasswordChangeService passwordChangeService;
    private final SessionService sessionService;
    private final AccessTokenCookieService accessTokenCookieService;
    private final DeviceTokenCookieService deviceTokenCookieService;

    /**
     * Выгрузка своей библиотеки. Ответ стримится, а не собирается в массив байтов: библиотека
     * на несколько тысяч записей вместе с историей чтения — это не тот объём, который стоит
     * держать в памяти целиком.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @GetMapping( "/export" )
    public ResponseEntity<StreamingResponseBody> export( @RequestParam( defaultValue = "json" ) String format ) {
        User owner = userService.getCurrentUser();
        boolean csv = "csv".equalsIgnoreCase( format );
        String normalized = csv ? "csv" : "json";

        StreamingResponseBody body = output -> {
            if ( csv ) {
                userDataExportService.writeCsv( owner, output );
            } else {
                userDataExportService.writeJson( owner, output );
            }
        };

        return ResponseEntity.ok()
                             .header( HttpHeaders.CONTENT_DISPOSITION,
                                      "attachment; filename=\""
                                      + userDataExportService.fileName( owner, normalized ) + "\"" )
                             .contentType( csv
                                                   ? MediaType.parseMediaType( "text/csv; charset=UTF-8" )
                                                   : MediaType.APPLICATION_JSON )
                             .body( body );
    }

    /**
     * Смена собственного пароля. Куки гасятся вместе с сессиями: пароль меняют, когда старый мог
     * утечь, и оставлять по нему открытый вход — значит не сделать того, ради чего его меняли.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/password" )
    public ResponseEntity<Void> changePassword( @Valid @RequestBody PasswordChangeRequest request ) {
        passwordChangeService.changeOwnPassword( request.getCurrentPassword(), request.getNewPassword() );

        return ResponseEntity.noContent()
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
                             .header( HttpHeaders.SET_COOKIE, deviceTokenCookieService.buildExpired().toString() )
                             .build();
    }

    /**
     * Удаление собственного аккаунта. Куки гасятся тем же способом, что при выходе: без этого
     * браузер продолжал бы слать ключи от того, чего уже нет.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping
    public ResponseEntity<Void> delete( @Valid @RequestBody AccountDeletionRequest request ) {
        accountDeletionService.deleteCurrentAccount( request.getPassword() );

        return ResponseEntity.noContent()
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
                             .build();
    }
}
