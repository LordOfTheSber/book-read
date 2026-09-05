package com.library.tracker.security;

import com.library.tracker.domain.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;

import javax.crypto.SecretKey;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    /** HMAC-SHA256 требует ключ не короче 256 бит. */
    private static final int MIN_SECRET_BYTES = 32;

    /** Секрет, попавший в публичный репозиторий: запрещён везде, даже если задан явно. */
    private static final String COMPROMISED_SECRET = "change_this_secret_change_this_secret";

    private static final String PROD_PROFILE = "prod";

    private final Environment environment;

    @Value( "${security.jwt.secret:}" )
    private String secret;

    @Value( "${security.jwt.expiration-ms:1800000}" )
    private long expirationMs;

    private SecretKey signingKey;
    private JwtParser jwtParser;

    @PostConstruct
    void init() {
        this.signingKey = Keys.hmacShaKeyFor( resolveSecret().getBytes( StandardCharsets.UTF_8 ) );
        this.jwtParser = Jwts.parser().verifyWith( signingKey ).build();
    }

    public String generateToken( User user ) {
        Date now = new Date();
        Date expiry = new Date( now.getTime() + expirationMs );
        return Jwts.builder()
                   .subject( user.getUsername() )
                   .issuedAt( now )
                   .expiration( expiry )
                   .signWith( signingKey )
                   .compact();
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public String extractUsername( String token ) {
        return parseClaims( token ).getSubject();
    }

    public boolean isTokenValid( String token ) {
        try {
            Claims claims = parseClaims( token );
            return claims.getExpiration() == null || claims.getExpiration().after( new Date() );
        } catch ( Exception ex ) {
            return false;
        }
    }

    private Claims parseClaims( String token ) {
        return jwtParser.parseSignedClaims( token ).getPayload();
    }

    /**
     * В профиле {@code prod} секрет обязателен и приложение падает на старте, если он не задан
     * или слишком короткий. Вне прода допустим одноразовый случайный секрет: токены переживают
     * работу приложения, но не его перезапуск.
     */
    private String resolveSecret() {
        boolean production = Arrays.asList( environment.getActiveProfiles() ).contains( PROD_PROFILE );

        if ( !StringUtils.hasText( secret ) ) {
            if ( production ) {
                throw new IllegalStateException(
                        "Не задан SECURITY_JWT_SECRET: в профиле prod JWT-секрет обязателен. "
                        + "Сгенерируйте его командой `openssl rand -base64 48` и передайте через окружение." );
            }
            log.warn( "SECURITY_JWT_SECRET не задан — сгенерирован временный секрет. "
                      + "После перезапуска выданные токены перестанут действовать. "
                      + "Для стабильной работы задайте SECURITY_JWT_SECRET." );
            return generateEphemeralSecret();
        }

        if ( COMPROMISED_SECRET.equals( secret ) ) {
            throw new IllegalStateException(
                    "SECURITY_JWT_SECRET совпадает со скомпрометированным значением из репозитория. "
                    + "Сгенерируйте новый секрет командой `openssl rand -base64 48`." );
        }

        int length = secret.getBytes( StandardCharsets.UTF_8 ).length;
        if ( length < MIN_SECRET_BYTES ) {
            throw new IllegalStateException(
                    "SECURITY_JWT_SECRET короче " + MIN_SECRET_BYTES + " байт (сейчас " + length + "). "
                    + "Сгенерируйте секрет командой `openssl rand -base64 48`." );
        }

        return secret;
    }

    private String generateEphemeralSecret() {
        byte[] random = new byte[MIN_SECRET_BYTES];
        new SecureRandom().nextBytes( random );
        return Base64.getEncoder().encodeToString( random );
    }
}
