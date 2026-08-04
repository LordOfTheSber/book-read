package com.library.tracker.web;

import com.library.tracker.domain.Session;
import com.library.tracker.domain.User;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.UserService;
import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.AuthRequest;
import com.library.tracker.web.dto.AuthResponse;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @PostMapping( "/login" )
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequest request
                                             ) {
        UsernamePasswordAuthenticationToken token =
                new UsernamePasswordAuthenticationToken( request.getUsername(), request.getPassword() );
        Authentication authentication = authenticationManager.authenticate( token );

        User user = userService.findByUsername( authentication.getName() )
                               .orElseThrow( () -> new IllegalStateException( "User not found after login" ) );
        return authenticated( user, sessionService.createSession( user ) );
    }

    @PostMapping( "/register" )
    public ResponseEntity<AuthResponse> register( @Valid @RequestBody RegisterRequest request ) {
        User user = userService.register( request.getUsername(), request.getPassword() );
        return authenticated( user, sessionService.createSession( user ) );
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

        return authenticated( user.get(), session.get() );
    }

    /** Завершает серверную сессию и стирает куку. Повторный вызов безопасен. */
    @PostMapping( "/logout" )
    public ResponseEntity<Void> logout( HttpServletRequest request ) {
        sessionService.extractSessionId( request.getCookies() ).ifPresent( this::invalidateQuietly );
        return ResponseEntity.noContent()
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
                             .build();
    }

    private ResponseEntity<AuthResponse> authenticated( User user, Session session ) {
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
                                            .build();
        return ResponseEntity.ok()
                             .header( HttpHeaders.SET_COOKIE, sessionCookie.toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookie.toString() )
                             .body( response );
    }

    private ResponseEntity<AuthResponse> unauthorized() {
        return ResponseEntity.status( HttpStatus.UNAUTHORIZED )
                             .header( HttpHeaders.SET_COOKIE, sessionService.buildExpiredCookie().toString() )
                             .header( HttpHeaders.SET_COOKIE, accessTokenCookieService.buildExpired().toString() )
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
