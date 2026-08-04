package com.library.tracker.service;

import com.library.tracker.domain.Session;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseCookie;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class SessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private SessionSettingsService sessionSettingsService;

    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        sessionService = new SessionService( sessionRepository, sessionSettingsService );
        ReflectionTestUtils.setField( sessionService, "sameSite", "Lax" );
        sessionService.init();
    }

    @Test
    void createSessionPersistsWithTiming() {
        User user = new User();
        user.setUsername( "alex" );
        when( sessionSettingsService.resolveTiming( eq( user ) ) )
                .thenReturn( new SessionSettingsService.SessionTiming( 15, 60 ) );
        when( sessionRepository.save( any( Session.class ) ) ).thenAnswer( invocation -> {
            Session session = invocation.getArgument( 0 );
            session.setId( UUID.randomUUID() );
            return session;
        } );

        Session session = sessionService.createSession( user );

        assertThat( session.getId() ).isNotNull();
        assertThat( session.getExpiresAt() ).isAfter( OffsetDateTime.now( ZoneOffset.UTC ) );
        verify( sessionRepository ).save( any( Session.class ) );
    }

    @Test
    void validateAndRefreshRejectsMismatchedUsername() {
        User user = new User();
        user.setUsername( "alex" );
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setUser( user );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 10 ) );
        session.setMaxExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 20 ) );

        when( sessionRepository.findById( eq( session.getId() ) ) ).thenReturn( Optional.of( session ) );

        Optional<Session> result = sessionService.validateAndRefresh( session.getId(), "other" );

        assertThat( result ).isEmpty();
    }

    @Test
    void validateAndRefreshInvalidatesExpiredSession() {
        User user = new User();
        user.setUsername( "alex" );
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setUser( user );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).minusMinutes( 1 ) );
        session.setMaxExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).minusMinutes( 1 ) );

        when( sessionRepository.findById( eq( session.getId() ) ) ).thenReturn( Optional.of( session ) );

        Optional<Session> result = sessionService.validateAndRefresh( session.getId(), "alex" );

        assertThat( result ).isEmpty();
        verify( sessionRepository ).deleteById( eq( session.getId() ) );
    }

    @Test
    void buildCookieCapsNegativeDuration() {
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).minusMinutes( 1 ) );

        ResponseCookie cookie = sessionService.buildCookie( session );

        assertThat( cookie.getMaxAge().getSeconds() ).isZero();
        assertThat( cookie.getName() ).isEqualTo( SessionService.SESSION_COOKIE );
    }

    @Test
    void buildCookieAppliesConfiguredSecureFlag() {
        ReflectionTestUtils.setField( sessionService, "secureCookie", true );
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 10 ) );

        ResponseCookie cookie = sessionService.buildCookie( session );

        assertThat( cookie.isSecure() ).isTrue();
        assertThat( cookie.isHttpOnly() ).isTrue();
        assertThat( cookie.getSameSite() ).isEqualTo( "Lax" );
    }

    @Test
    void buildCookieKeepsSecureOffWhenDisabled() {
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 10 ) );

        ResponseCookie cookie = sessionService.buildCookie( session );

        assertThat( cookie.isSecure() ).isFalse();
    }

    @Test
    void buildExpiredCookieClearsSessionCookie() {
        ResponseCookie cookie = sessionService.buildExpiredCookie();

        assertThat( cookie.getName() ).isEqualTo( SessionService.SESSION_COOKIE );
        assertThat( cookie.getValue() ).isEmpty();
        assertThat( cookie.getMaxAge().isZero() ).isTrue();
    }

    @Test
    void extractSessionIdParsesCookie() {
        UUID id = UUID.randomUUID();
        Cookie[] cookies = { new Cookie( SessionService.SESSION_COOKIE, id.toString() ) };

        Optional<UUID> result = sessionService.extractSessionId( cookies );

        assertThat( result ).contains( id );
    }
}
