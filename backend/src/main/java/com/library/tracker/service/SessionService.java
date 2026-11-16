package com.library.tracker.service;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.library.tracker.domain.Session;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.web.dto.SessionResponse;
import com.library.tracker.web.dto.SessionSettingsResponse;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional
public class SessionService {

    public static final String SESSION_COOKIE = "SESSION_ID";

    /** Ниже этого сдвига продление сессии не доходит до БД. */
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofMinutes( 1 );

    private final SessionRepository sessionRepository;
    private final SessionSettingsService sessionSettingsService;

    @Value( "${security.cookie.secure:false}" )
    private boolean secureCookie;

    @Value( "${security.cookie.same-site:Lax}" )
    private String sameSite;

    private Cache<UUID, Session> sessionCache;

    @PostConstruct
    void init() {
        this.sessionCache = CacheBuilder.newBuilder()
                                        .maximumSize( 10_000 )
                                        .expireAfterWrite( 2, TimeUnit.DAYS )
                                        .build();
    }

    public Session createSession( User user ) {
        SessionSettingsService.SessionTiming timing = sessionSettingsService.resolveTiming( user );
        OffsetDateTime now = OffsetDateTime.now( ZoneOffset.UTC );
        Session session = new Session();
        session.setUser( user );
        session.setExpiresAt( now.plusMinutes( timing.sessionTtlMinutes() ) );
        session.setMaxExpiresAt( now.plusMinutes( timing.maxSessionLifetimeMinutes() ) );
        session.getUser().getUsername();
        Session saved = sessionRepository.save( session );
        sessionCache.put( saved.getId(), saved );
        return saved;
    }

    @Transactional( readOnly = true )
    public Optional<Session> findCached( UUID id ) {
        Session cached = sessionCache.getIfPresent( id );
        if ( cached != null ) {
            return Optional.of( cached );
        }
        return sessionRepository.findById( id )
                                .map( session -> {
                                    sessionCache.put( session.getId(), session );
                                    return session;
                                } );
    }

    public Optional<Session> validateAndRefresh( UUID sessionId, String expectedUsername ) {
        if ( sessionId == null ) {
            return Optional.empty();
        }
        Session session = findCached( sessionId ).orElse( null );
        if ( session == null || !session.getUser().getUsername().equalsIgnoreCase( expectedUsername ) ) {
            return Optional.empty();
        }
        return renew( sessionId );
    }

    /**
     * Продлевает живую сессию по её идентификатору. В отличие от
     * {@link #validateAndRefresh(UUID, String)} не требует имени пользователя: используется при
     * обновлении access-токена, когда прежний JWT уже истёк и разобрать его нельзя.
     */
    public Optional<Session> renew( UUID sessionId ) {
        if ( sessionId == null ) {
            return Optional.empty();
        }
        Session session = findCached( sessionId ).orElse( null );
        if ( session == null ) {
            return Optional.empty();
        }
        if ( isExpired( session ) ) {
            invalidate( sessionId );
            return Optional.empty();
        }
        Session refreshed = refreshExpiry( session );
        sessionCache.put( refreshed.getId(), refreshed );
        return Optional.of( refreshed );
    }

    public void invalidate( UUID sessionId ) {
        if ( sessionId == null ) {
            return;
        }
        sessionCache.invalidate( sessionId );
        sessionRepository.deleteById( sessionId );
    }

    public ResponseCookie buildCookie( Session session ) {
        Duration ttl = Duration.between( OffsetDateTime.now( ZoneOffset.UTC ), session.getExpiresAt() );
        if ( ttl.isNegative() ) {
            ttl = Duration.ZERO;
        }
        return ResponseCookie.from( SESSION_COOKIE, session.getId().toString() )
                             .httpOnly( true )
                             .secure( secureCookie )
                             .path( "/" )
                             .sameSite( sameSite )
                             .maxAge( ttl )
                             .build();
    }

    /** Кука с нулевым сроком жизни: браузер удаляет сессионную куку при выходе. */
    public ResponseCookie buildExpiredCookie() {
        return ResponseCookie.from( SESSION_COOKIE, "" )
                             .httpOnly( true )
                             .secure( secureCookie )
                             .path( "/" )
                             .sameSite( sameSite )
                             .maxAge( Duration.ZERO )
                             .build();
    }

    public SessionResponse toResponse( Session session ) {
        return SessionResponse.builder()
                              .id( session.getId() )
                              .expiresAt( session.getExpiresAt() )
                              .maxExpiresAt( session.getMaxExpiresAt() )
                              .build();
    }

    public Optional<UUID> extractSessionId( Cookie[] cookies ) {
        if ( cookies == null ) {
            return Optional.empty();
        }
        for ( Cookie cookie : cookies ) {
            if ( SESSION_COOKIE.equals( cookie.getName() )
                 && StringUtils.hasText( cookie.getValue() ) )
            {
                try {
                    return Optional.of( UUID.fromString( cookie.getValue() ) );
                } catch ( IllegalArgumentException ignored ) {
                    return Optional.empty();
                }
            }
        }
        return Optional.empty();
    }

    public SessionSettingsResponse getGlobalSettings() {
        return sessionSettingsService.getSettings();
    }

    public SessionSettingsResponse updateGlobalSettings( int ttl, int maxLifetime ) {
        return sessionSettingsService.updateSettings( ttl, maxLifetime );
    }

    private boolean isExpired( Session session ) {
        OffsetDateTime now = OffsetDateTime.now( ZoneOffset.UTC );
        return now.isAfter( session.getExpiresAt() ) || now.isAfter( session.getMaxExpiresAt() );
    }

    /**
     * Продление стоило по одному UPDATE на каждый запрос: срок сдвигался на время, прошедшее с
     * прошлого продления, то есть буквально всегда. Теперь запись в БД происходит, только когда
     * сдвиг набрал {@link #MIN_REFRESH_INTERVAL} — для коротких TTL порог уменьшается вдвое от
     * самого TTL, чтобы сессия не успела истечь между продлениями.
     */
    private Session refreshExpiry( Session session ) {
        SessionSettingsService.SessionTiming timing = sessionSettingsService.resolveTiming( session.getUser() );
        OffsetDateTime now = OffsetDateTime.now( ZoneOffset.UTC );
        Duration ttl = Duration.ofMinutes( timing.sessionTtlMinutes() );
        OffsetDateTime newExpiry = now.plus( ttl );
        OffsetDateTime cappedExpiry = newExpiry.isAfter( session.getMaxExpiresAt() ) ? session.getMaxExpiresAt()
                                                                                     : newExpiry;

        Duration shift = Duration.between( session.getExpiresAt(), cappedExpiry );
        Duration threshold = min( MIN_REFRESH_INTERVAL, ttl.dividedBy( 2 ) );
        if ( shift.compareTo( threshold ) < 0 ) {
            return session;
        }

        session.setExpiresAt( cappedExpiry );
        return sessionRepository.save( session );
    }

    private static Duration min( Duration first, Duration second ) {
        return first.compareTo( second ) <= 0 ? first : second;
    }
}
