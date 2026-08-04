package com.library.tracker.web;

import com.library.tracker.domain.Session;
import com.library.tracker.domain.User;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.SessionService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.UserResponse;

import jakarta.servlet.http.Cookie;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private UserService userService;

    @Mock
    private JwtService jwtService;

    @Mock
    private SessionService sessionService;

    private AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController( authenticationManager, userService, jwtService, sessionService );
    }

    @Test
    void refreshIssuesNewTokenForLiveSession() {
        User user = user( "alex", false );
        Session session = session( user );
        MockHttpServletRequest request = requestWithSession( session.getId() );

        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.of( session.getId() ) );
        when( sessionService.renew( eq( session.getId() ) ) ).thenReturn( Optional.of( session ) );
        when( userService.findByUsername( eq( "alex" ) ) ).thenReturn( Optional.of( user ) );
        when( userService.toResponse( eq( user ) ) ).thenReturn( UserResponse.builder().username( "alex" ).build() );
        when( jwtService.generateToken( eq( user ) ) ).thenReturn( "fresh-token" );
        when( sessionService.buildCookie( eq( session ) ) ).thenReturn( sessionCookie() );

        ResponseEntity<AuthResponse> response = controller.refresh( request );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().getToken() ).isEqualTo( "fresh-token" );
        assertThat( response.getHeaders().get( HttpHeaders.SET_COOKIE ) ).isNotEmpty();
    }

    @Test
    void refreshRejectsRequestWithoutSession() {
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.empty() );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );

        ResponseEntity<AuthResponse> response = controller.refresh( new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        verify( jwtService, never() ).generateToken( any() );
    }

    @Test
    void refreshRejectsExpiredSession() {
        UUID sessionId = UUID.randomUUID();
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.of( sessionId ) );
        when( sessionService.renew( eq( sessionId ) ) ).thenReturn( Optional.empty() );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );

        ResponseEntity<AuthResponse> response = controller.refresh( requestWithSession( sessionId ) );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        verify( jwtService, never() ).generateToken( any() );
    }

    @Test
    void refreshDropsSessionOfBlockedUser() {
        User user = user( "alex", true );
        Session session = session( user );

        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.of( session.getId() ) );
        when( sessionService.renew( eq( session.getId() ) ) ).thenReturn( Optional.of( session ) );
        when( userService.findByUsername( eq( "alex" ) ) ).thenReturn( Optional.of( user ) );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );

        ResponseEntity<AuthResponse> response = controller.refresh( requestWithSession( session.getId() ) );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        verify( sessionService ).invalidate( eq( session.getId() ) );
        verify( jwtService, never() ).generateToken( any() );
    }

    @Test
    void logoutInvalidatesSessionAndClearsCookie() {
        UUID sessionId = UUID.randomUUID();
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.of( sessionId ) );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );

        ResponseEntity<Void> response = controller.logout( requestWithSession( sessionId ) );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        assertThat( response.getHeaders().getFirst( HttpHeaders.SET_COOKIE ) )
                .contains( SessionService.SESSION_COOKIE );
        verify( sessionService ).invalidate( eq( sessionId ) );
    }

    @Test
    void logoutSucceedsWithoutSessionCookie() {
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.empty() );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );

        ResponseEntity<Void> response = controller.logout( new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        verify( sessionService, never() ).invalidate( any() );
    }

    private MockHttpServletRequest requestWithSession( UUID sessionId ) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies( new Cookie( SessionService.SESSION_COOKIE, sessionId.toString() ) );
        return request;
    }

    private User user( String username, boolean blocked ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        user.setBlocked( blocked );
        return user;
    }

    private Session session( User user ) {
        Session session = new Session();
        session.setId( UUID.randomUUID() );
        session.setUser( user );
        session.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusMinutes( 30 ) );
        session.setMaxExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusHours( 24 ) );
        return session;
    }

    private ResponseCookie sessionCookie() {
        return ResponseCookie.from( SessionService.SESSION_COOKIE, UUID.randomUUID().toString() )
                             .maxAge( Duration.ofMinutes( 30 ) )
                             .build();
    }

    private ResponseCookie expiredCookie() {
        return ResponseCookie.from( SessionService.SESSION_COOKIE, "" ).maxAge( Duration.ZERO ).build();
    }
}
