package com.library.tracker.web;

import com.library.tracker.domain.Session;
import com.library.tracker.domain.TrustedDevice;
import com.library.tracker.domain.User;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.DeviceTokenCookieService;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.TrustedDeviceService;
import com.library.tracker.service.UserService;
import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.AuthRequest;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.DeviceEnrollmentRequest;
import com.library.tracker.web.dto.DeviceHintResponse;
import com.library.tracker.web.dto.DeviceLoginRequest;
import com.library.tracker.web.dto.RegisterRequest;
import com.library.tracker.web.dto.SessionResponse;
import com.library.tracker.web.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/auth" )
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final SessionService sessionService;
    private final AccessTokenCookieService accessTokenCookieService;
    private final TrustedDeviceService trustedDeviceService;
    private final DeviceTokenCookieService deviceTokenCookieService;

    @PostMapping( "/login" )
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequest request, HttpServletRequest httpRequest
                                             ) {
        UsernamePasswordAuthenticationToken token =
                new UsernamePasswordAuthenticationToken( request.getUsername(), request.getPassword() );
        Authentication authentication = authenticationManager.authenticate( token );

        User user = userService.findByUsername( authentication.getName() )
                               .orElseThrow( () -> new IllegalStateException( "User not found after login" ) );
        return authenticated( user, sessionService.createSession( user ),
                              rememberDevice( user, request, httpRequest ) );
    }

    @PostMapping( "/register" )
    public ResponseEntity<AuthResponse> register( @Valid @RequestBody RegisterRequest request,
                                                  HttpServletRequest httpRequest ) {
        User user = userService.register( request.getUsername(), request.getPassword() );
        return authenticated( user, sessionService.createSession( user ),
                              rememberDevice( user, request, httpRequest ) );
    }

    /**
     * Выдаёт новый access-токен по живой серверной сессии. Прежний JWT предъявлять не нужно —
     * к моменту обновления он, как правило, уже истёк.
     */
    @PostMapping( "/refresh" )
    public ResponseEntity<AuthResponse> refresh( HttpServletRequest request ) {
        Optional<Session> session = sessionService.extractSessionId( request.getCookies() )
                                                  .flatMap( sessionService::renew );
        if ( session.isEmpty() ) {
            return unauthorized();
        }

        Optional<User> user = userService.findByUsername( session.get().getUser().getUsername() );
        if ( user.isEmpty() || user.get().isBlocked() ) {
            sessionService.invalidate( session.get().getId() );
            return unauthorized();
        }

        return authenticated( user.get(), session.get(), null );
    }

    /**
     * Кого предлагает это устройство. Отвечает 204, если устройство неизвестно, — экран входа
     * покажет обычную форму и не будет ждать ничего лишнего.
     */
    @GetMapping( "/device" )
    public ResponseEntity<DeviceHintResponse> deviceHint( @RequestParam String fingerprint,
                                                          HttpServletRequest request ) {
        Optional<TrustedDevice> device = deviceToken( request )
                .flatMap( token -> trustedDeviceService.peek( token, fingerprint ) );
        if ( device.isEmpty() ) {
            return ResponseEntity.noContent().build();
        }

        User user = device.get().getUser();
        if ( user.isBlocked() ) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok( DeviceHintResponse.builder()
                                                    .username( user.getUsername() )
                                                    .displayName( user.getDisplayName() )
                                                    .deviceLabel( device.get().getLabel() )
                                                    .lastUsedAt( device.get().getLastUsedAt() )
                                                    .build() );
    }

    /**
     * Вход без пароля с доверенного устройства. Секрет устройства меняется на каждом входе,
     * поэтому ответ всегда несёт новую куку.
     */
    @PostMapping( "/device/login" )
    public ResponseEntity<AuthResponse> deviceLogin( @Valid @RequestBody DeviceLoginRequest request,
                                                     HttpServletRequest httpRequest ) {
        Optional<TrustedDeviceService.IssuedDevice> issued = deviceToken( httpRequest )
                .flatMap( token -> trustedDeviceService.authenticate( token, request.getFingerprint(),
                                                                      userAgent( httpRequest ),
                                                                      clientIp( httpRequest ) ) );
        if ( issued.isEmpty() ) {
            // Кука не подошла: она либо истекла, либо отозвана с другого устройства. Гасим её,
            // чтобы браузер не предлагал быстрый вход, которого больше нет.
            return unauthorizedDevice();
        }

        User user = issued.get().device().getUser();
        return authenticated( user, sessionService.createSession( user ), deviceCookie( issued.get() ) );
    }

    /** «Это не я» на экране входа: устройство перестаёт быть доверенным. */
    @DeleteMapping( "/device" )
    public ResponseEntity<Void> forgetDevice( HttpServletRequest request ) {
        deviceToken( request ).ifPresent( trustedDeviceService::forget );
        return ResponseEntity.noContent()
                             .header( HttpHeaders.SET_COOKIE, deviceTokenCookieService.buildExpired().toString() )
                             .build();
    }

    /**
     * Завершает серверную сессию и стирает куки доступа. Доверие устройства при этом остаётся:
     * человек нажал «выйти», а не «забыть это устройство», и на экране входа его встретит
     * кнопка «продолжить как». Отозвать доверие можно там же и в профиле.
     */
    @PostMapping( "/logout" )
    public ResponseEntity<Void> logout( HttpServletRequest request ) {
        sessionService.extractSessionId( request.getCookies() ).ifPresent( this::invalidateQuietly );
        return ResponseEntity.noContent()
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
                             .build();
    }

    /** Запоминает устройство, если человек об этом попросил и браузер прислал отпечаток. */
    private ResponseCookie rememberDevice( User user, DeviceEnrollmentRequest request,
                                           HttpServletRequest httpRequest ) {
        if ( !request.isRememberDevice() || !StringUtils.hasText( request.getDeviceFingerprint() ) ) {
            return null;
        }
        return trustedDeviceService.remember( user, request.getDeviceFingerprint(), userAgent( httpRequest ),
                                              clientIp( httpRequest ), request.getDeviceName() )
                                   .map( this::deviceCookie )
                                   .orElse( null );
    }

    private ResponseCookie deviceCookie( TrustedDeviceService.IssuedDevice issued ) {
        return deviceTokenCookieService.build( issued.token(), trustedDeviceService.ttl() );
    }

    private Optional<String> deviceToken( HttpServletRequest request ) {
        return deviceTokenCookieService.extract( request.getCookies() );
    }

    private String userAgent( HttpServletRequest request ) {
        return request.getHeader( HttpHeaders.USER_AGENT );
    }

    /**
     * Адрес клиента для списка устройств. За обратным прокси {@code getRemoteAddr} возвращает
     * сам прокси, поэтому первым берётся левый адрес из {@code X-Forwarded-For}. Заголовок
     * подделывается, и полагаться на него в решениях о доступе нельзя — здесь он только
     * показывается человеку.
     */
    private String clientIp( HttpServletRequest request ) {
        String forwarded = request.getHeader( "X-Forwarded-For" );
        if ( StringUtils.hasText( forwarded ) ) {
            return forwarded.split( "," )[0].strip();
        }
        return request.getRemoteAddr();
    }

    private ResponseEntity<AuthResponse> authenticated( User user, Session session, ResponseCookie deviceCookie ) {
        UserResponse userResponse = userService.toResponse( user );
        String jwt = jwtService.generateToken( user );
        ResponseCookie sessionCookie = sessionService.buildCookie( session );
        ResponseCookie accessTokenCookie =
                accessTokenCookieService.build( jwt, Duration.ofMillis( jwtService.getExpirationMs() ) );
        AuthResponse response = AuthResponse.builder()
                                            .user( userResponse )
                                            .session( SessionResponse.builder()
                                                                      .id( session.getId() )
                                                                      .expiresAt( session.getExpiresAt() )
                                                                      .maxExpiresAt( session.getMaxExpiresAt() )
                                                                      .build() )
                                            .deviceRemembered( deviceCookie != null )
                                            .build();
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                                                           .header( HttpHeaders.SET_COOKIE, sessionCookie.toString() )
                                                           .header( HttpHeaders.SET_COOKIE,
                                                                    accessTokenCookie.toString() );
        if ( deviceCookie != null ) {
            builder.header( HttpHeaders.SET_COOKIE, deviceCookie.toString() );
        }
        return builder.body( response );
    }

    private ResponseEntity<AuthResponse> unauthorized() {
        return ResponseEntity.status( HttpStatus.UNAUTHORIZED )
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
                             .build();
    }

    private ResponseEntity<AuthResponse> unauthorizedDevice() {
        return ResponseEntity.status( HttpStatus.UNAUTHORIZED )
                             .header( HttpHeaders.SET_COOKIE, deviceTokenCookieService.buildExpired().toString() )
                             .build();
    }

    /** Сессия могла истечь или быть удалённой параллельно — выход всё равно должен завершиться успешно. */
    private void invalidateQuietly( UUID sessionId ) {
        try {
            sessionService.invalidate( sessionId );
        } catch ( RuntimeException ignored ) {
            // Нечего завершать: сессии уже нет.
        }
    }
}
