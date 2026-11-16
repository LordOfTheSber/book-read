package com.library.tracker.security;

import jakarta.servlet.http.Cookie;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Access-токен ездит в httpOnly-куке, а не в теле ответа: иначе он оседает в {@code localStorage}
 * и достаётся любому XSS.
 * <p>
 * Кука отправляется браузером автоматически, поэтому единственное, что отделяет API от CSRF, —
 * атрибут {@code SameSite}: при {@code Lax} межсайтовые POST/PUT/DELETE куку не несут. Ослаблять
 * {@code security.cookie.same-site} до {@code None} нельзя, не включив CSRF-токены.
 */
@Component
public class AccessTokenCookieService {

    public static final String ACCESS_TOKEN_COOKIE = "ACCESS_TOKEN";

    private static final String BEARER_PREFIX = "Bearer ";

    @Value( "${security.cookie.secure:false}" )
    private boolean secureCookie;

    @Value( "${security.cookie.same-site:Lax}" )
    private String sameSite;

    public ResponseCookie build( String token, Duration ttl ) {
        return baseCookie( token ).maxAge( ttl.isNegative() ? Duration.ZERO : ttl ).build();
    }

    /** Кука с нулевым сроком жизни: браузер удаляет токен при выходе. */
    public ResponseCookie buildExpired() {
        return baseCookie( "" ).maxAge( Duration.ZERO ).build();
    }

    public Optional<String> extract( Cookie[] cookies ) {
        if ( cookies == null ) {
            return Optional.empty();
        }
        for ( Cookie cookie : cookies ) {
            if ( ACCESS_TOKEN_COOKIE.equals( cookie.getName() ) && StringUtils.hasText( cookie.getValue() ) ) {
                return Optional.of( cookie.getValue() );
            }
        }
        return Optional.empty();
    }

    /**
     * Запасной путь для клиентов без хранилища кук — curl, интеграционные тесты, вызовы между
     * сервисами. Браузерный фронтенд заголовок не отправляет.
     */
    public Optional<String> extractFromHeader( String authorizationHeader ) {
        if ( !StringUtils.hasText( authorizationHeader ) || !authorizationHeader.startsWith( BEARER_PREFIX ) ) {
            return Optional.empty();
        }
        String token = authorizationHeader.substring( BEARER_PREFIX.length() );
        return StringUtils.hasText( token ) ? Optional.of( token ) : Optional.empty();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie( String value ) {
        return ResponseCookie.from( ACCESS_TOKEN_COOKIE, value )
                             .httpOnly( true )
                             .secure( secureCookie )
                             .path( "/" )
                             .sameSite( sameSite );
    }
}
