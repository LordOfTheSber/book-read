package com.library.tracker.security;

import jakarta.servlet.http.Cookie;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Кука доверенного устройства: единственное, что переживает истечение сессии и позволяет войти
 * без пароля.
 * <p>
 * Путь у неё уже, чем у остальных кук, — {@code /api/v1/auth}. Секрет живёт месяцами, и посылать
 * его в каждый запрос за обложкой значит без нужды множить места, откуда он может утечь: он нужен
 * ровно двум точкам — быстрому входу и «забыть устройство».
 * <p>
 * {@code SameSite} здесь так же обязателен, как у {@code ACCESS_TOKEN}: без него межсайтовый POST
 * на быстрый вход выдал бы злоумышленнику живую сессию жертвы.
 */
@Component
public class DeviceTokenCookieService {

    public static final String DEVICE_TOKEN_COOKIE = "DEVICE_TOKEN";

    /** Кука нужна только endpoint-ам входа, а не всему API. */
    public static final String COOKIE_PATH = "/api/v1/auth";

    @Value( "${security.cookie.secure:false}" )
    private boolean secureCookie;

    @Value( "${security.cookie.same-site:Lax}" )
    private String sameSite;

    public ResponseCookie build( String token, Duration ttl ) {
        return baseCookie( token ).maxAge( ttl.isNegative() ? Duration.ZERO : ttl ).build();
    }

    /** Кука с нулевым сроком: браузер забывает устройство. */
    public ResponseCookie buildExpired() {
        return baseCookie( "" ).maxAge( Duration.ZERO ).build();
    }

    public Optional<String> extract( Cookie[] cookies ) {
        if ( cookies == null ) {
            return Optional.empty();
        }
        for ( Cookie cookie : cookies ) {
            if ( DEVICE_TOKEN_COOKIE.equals( cookie.getName() ) && StringUtils.hasText( cookie.getValue() ) ) {
                return Optional.of( cookie.getValue() );
            }
        }
        return Optional.empty();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie( String value ) {
        return ResponseCookie.from( DEVICE_TOKEN_COOKIE, value )
                             .httpOnly( true )
                             .secure( secureCookie )
                             .path( COOKIE_PATH )
                             .sameSite( sameSite );
    }
}
