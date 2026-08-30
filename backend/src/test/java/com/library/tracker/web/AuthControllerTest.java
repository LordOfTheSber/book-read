package com.library.tracker.web;

import com.library.tracker.domain.Session;
import com.library.tracker.domain.TrustedDevice;
import com.library.tracker.domain.User;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.DeviceTokenCookieService;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.SessionService;
import com.library.tracker.service.TrustedDeviceService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.AuthRequest;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.DeviceHintResponse;
import com.library.tracker.web.dto.DeviceLoginRequest;
import com.library.tracker.web.dto.UserResponse;

import jakarta.servlet.http.Cookie;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

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

    @Mock
    private AccessTokenCookieService accessTokenCookieService;

    @Mock
    private TrustedDeviceService trustedDeviceService;

    @Mock
    private DeviceTokenCookieService deviceTokenCookieService;

    private AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController( authenticationManager, userService, jwtService, sessionService,
                                         accessTokenCookieService, trustedDeviceService,
                                         deviceTokenCookieService );
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
        when( jwtService.getExpirationMs() ).thenReturn( 1_800_000L );
        when( sessionService.buildCookie( eq( session ) ) ).thenReturn( sessionCookie() );
        when( accessTokenCookieService.build( eq( "fresh-token" ), any() ) ).thenReturn( accessTokenCookie() );

        ResponseEntity<AuthResponse> response = controller.refresh( request );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().getUser() ).isNotNull();
        assertThat( response.getHeaders().get( HttpHeaders.SET_COOKIE ) )
                .anySatisfy( cookie -> assertThat( cookie ).contains(
                        AccessTokenCookieService.ACCESS_TOKEN_COOKIE + "=fresh-token" ) );
    }

    @Test
    void refreshRejectsRequestWithoutSession() {
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.empty() );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

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
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

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
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

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
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

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
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

        ResponseEntity<Void> response = controller.logout( new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        verify( sessionService, never() ).invalidate( any() );
    }

    /**
     * Быстрый вход выдаёт сессию и новую куку устройства: секрет меняется на каждом входе,
     * и старое значение после этого не должно работать.
     */
    @Test
    void deviceLoginIssuesSessionAndRotatesDeviceCookie() {
        User user = user( "alex", false );
        Session session = session( user );
        TrustedDeviceService.IssuedDevice issued =
                new TrustedDeviceService.IssuedDevice( device( user ), "rotated-secret" );

        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.of( "stored-secret" ) );
        when( trustedDeviceService.authenticate( eq( "stored-secret" ), eq( "fp" ), any(), any() ) )
                .thenReturn( Optional.of( issued ) );
        when( trustedDeviceService.ttl() ).thenReturn( Duration.ofDays( 90 ) );
        when( deviceTokenCookieService.build( eq( "rotated-secret" ), any() ) )
                .thenReturn( deviceCookie( "rotated-secret" ) );
        when( sessionService.createSession( eq( user ) ) ).thenReturn( session );
        when( userService.toResponse( eq( user ) ) ).thenReturn( UserResponse.builder().username( "alex" ).build() );
        when( jwtService.generateToken( eq( user ) ) ).thenReturn( "fresh-token" );
        when( jwtService.getExpirationMs() ).thenReturn( 1_800_000L );
        when( sessionService.buildCookie( eq( session ) ) ).thenReturn( sessionCookie() );
        when( accessTokenCookieService.build( eq( "fresh-token" ), any() ) ).thenReturn( accessTokenCookie() );

        ResponseEntity<AuthResponse> response = controller.deviceLogin( deviceLoginRequest( "fp" ),
                                                                       new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().isDeviceRemembered() ).isTrue();
        assertThat( response.getHeaders().get( HttpHeaders.SET_COOKIE ) )
                .anySatisfy( cookie -> assertThat( cookie ).contains(
                        DeviceTokenCookieService.DEVICE_TOKEN_COOKIE + "=rotated-secret" ) );
    }

    /** Кука, которую отозвали с другого устройства, должна гаснуть, а не предлагать вход снова. */
    @Test
    void deviceLoginClearsCookieOfUnknownDevice() {
        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.of( "stale-secret" ) );
        when( trustedDeviceService.authenticate( eq( "stale-secret" ), eq( "fp" ), any(), any() ) )
                .thenReturn( Optional.empty() );
        when( deviceTokenCookieService.buildExpired() ).thenReturn( expiredDeviceCookie() );

        ResponseEntity<AuthResponse> response = controller.deviceLogin( deviceLoginRequest( "fp" ),
                                                                       new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        assertThat( response.getHeaders().getFirst( HttpHeaders.SET_COOKIE ) )
                .contains( DeviceTokenCookieService.DEVICE_TOKEN_COOKIE + "=" );
        verify( sessionService, never() ).createSession( any() );
    }

    @Test
    void deviceLoginWithoutCookieDoesNotTouchDevices() {
        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.empty() );
        when( deviceTokenCookieService.buildExpired() ).thenReturn( expiredDeviceCookie() );

        ResponseEntity<AuthResponse> response = controller.deviceLogin( deviceLoginRequest( "fp" ),
                                                                       new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        verify( trustedDeviceService, never() ).authenticate( any(), any(), any(), any() );
    }

    @Test
    void deviceHintNamesRememberedUser() {
        User user = user( "alex", false );
        user.setDisplayName( "Алексей" );

        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.of( "stored-secret" ) );
        when( trustedDeviceService.peek( eq( "stored-secret" ), eq( "fp" ) ) )
                .thenReturn( Optional.of( device( user ) ) );

        ResponseEntity<DeviceHintResponse> response = controller.deviceHint( "fp", new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().getUsername() ).isEqualTo( "alex" );
        assertThat( response.getBody().getDisplayName() ).isEqualTo( "Алексей" );
    }

    /** Заблокированному быстрый вход не предлагают: кнопка «продолжить как» вела бы в отказ. */
    @Test
    void deviceHintStaysSilentForBlockedUser() {
        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.of( "stored-secret" ) );
        when( trustedDeviceService.peek( eq( "stored-secret" ), eq( "fp" ) ) )
                .thenReturn( Optional.of( device( user( "alex", true ) ) ) );

        ResponseEntity<DeviceHintResponse> response = controller.deviceHint( "fp", new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
    }

    @Test
    void deviceHintStaysSilentWithoutCookie() {
        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.empty() );

        ResponseEntity<DeviceHintResponse> response = controller.deviceHint( "fp", new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
    }

    /** Устройство запоминается только по явной просьбе — и только когда отпечаток прислали. */
    @Test
    void loginRemembersDeviceOnlyWhenAsked() {
        User user = user( "alex", false );
        Session session = session( user );
        stubSuccessfulLogin( user, session );

        controller.login( authRequest( false, "fp" ), new MockHttpServletRequest() );
        controller.login( authRequest( true, null ), new MockHttpServletRequest() );

        verify( trustedDeviceService, never() ).remember( any(), any(), any(), any(), any() );
    }

    @Test
    void loginRemembersDeviceWhenAsked() {
        User user = user( "alex", false );
        Session session = session( user );
        stubSuccessfulLogin( user, session );

        TrustedDeviceService.IssuedDevice issued =
                new TrustedDeviceService.IssuedDevice( device( user ), "new-secret" );
        when( trustedDeviceService.remember( eq( user ), eq( "fp" ), any(), any(), any() ) )
                .thenReturn( Optional.of( issued ) );
        when( trustedDeviceService.ttl() ).thenReturn( Duration.ofDays( 90 ) );
        when( deviceTokenCookieService.build( eq( "new-secret" ), any() ) )
                .thenReturn( deviceCookie( "new-secret" ) );

        ResponseEntity<AuthResponse> response = controller.login( authRequest( true, "fp" ),
                                                                 new MockHttpServletRequest() );

        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().isDeviceRemembered() ).isTrue();
        assertThat( response.getHeaders().get( HttpHeaders.SET_COOKIE ) )
                .anySatisfy( cookie -> assertThat( cookie ).contains(
                        DeviceTokenCookieService.DEVICE_TOKEN_COOKIE + "=new-secret" ) );
    }

    @Test
    void forgetDeviceDropsTrustAndCookie() {
        when( deviceTokenCookieService.extract( any() ) ).thenReturn( Optional.of( "stored-secret" ) );
        when( deviceTokenCookieService.buildExpired() ).thenReturn( expiredDeviceCookie() );

        ResponseEntity<Void> response = controller.forgetDevice( new MockHttpServletRequest() );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        verify( trustedDeviceService ).forget( eq( "stored-secret" ) );
    }

    /** Выход гасит сессию, но доверие устройства оставляет: это разные решения человека. */
    @Test
    void logoutKeepsDeviceTrust() {
        UUID sessionId = UUID.randomUUID();
        when( sessionService.extractSessionId( any() ) ).thenReturn( Optional.of( sessionId ) );
        when( sessionService.buildExpiredCookie() ).thenReturn( expiredCookie() );
        when( accessTokenCookieService.buildExpired() ).thenReturn( expiredAccessTokenCookie() );

        ResponseEntity<Void> response = controller.logout( requestWithSession( sessionId ) );

        assertThat( response.getHeaders().get( HttpHeaders.SET_COOKIE ) )
                .noneSatisfy( cookie -> assertThat( cookie )
                        .contains( DeviceTokenCookieService.DEVICE_TOKEN_COOKIE ) );
        verify( trustedDeviceService, never() ).forget( any() );
    }

    private void stubSuccessfulLogin( User user, Session session ) {
        when( authenticationManager.authenticate( any() ) )
                .thenReturn( new UsernamePasswordAuthenticationToken( user.getUsername(), null, List.of() ) );
        when( userService.findByUsername( eq( user.getUsername() ) ) ).thenReturn( Optional.of( user ) );
        when( sessionService.createSession( eq( user ) ) ).thenReturn( session );
        when( userService.toResponse( eq( user ) ) )
                .thenReturn( UserResponse.builder().username( user.getUsername() ).build() );
        when( jwtService.generateToken( eq( user ) ) ).thenReturn( "fresh-token" );
        when( jwtService.getExpirationMs() ).thenReturn( 1_800_000L );
        when( sessionService.buildCookie( eq( session ) ) ).thenReturn( sessionCookie() );
        when( accessTokenCookieService.build( eq( "fresh-token" ), any() ) ).thenReturn( accessTokenCookie() );
    }

    private AuthRequest authRequest( boolean rememberDevice, String fingerprint ) {
        AuthRequest request = new AuthRequest();
        request.setUsername( "alex" );
        request.setPassword( "biblioteka1" );
        request.setRememberDevice( rememberDevice );
        request.setDeviceFingerprint( fingerprint );
        return request;
    }

    private DeviceLoginRequest deviceLoginRequest( String fingerprint ) {
        DeviceLoginRequest request = new DeviceLoginRequest();
        request.setFingerprint( fingerprint );
        return request;
    }

    private TrustedDevice device( User user ) {
        TrustedDevice device = new TrustedDevice();
        device.setId( UUID.randomUUID() );
        device.setUser( user );
        device.setLabel( "Chrome · Windows" );
        device.setLastUsedAt( OffsetDateTime.now( ZoneOffset.UTC ) );
        device.setExpiresAt( OffsetDateTime.now( ZoneOffset.UTC ).plusDays( 90 ) );
        return device;
    }

    private ResponseCookie deviceCookie( String token ) {
        return ResponseCookie.from( DeviceTokenCookieService.DEVICE_TOKEN_COOKIE, token )
                             .httpOnly( true )
                             .path( DeviceTokenCookieService.COOKIE_PATH )
                             .maxAge( Duration.ofDays( 90 ) )
                             .build();
    }

    private ResponseCookie expiredDeviceCookie() {
        return ResponseCookie.from( DeviceTokenCookieService.DEVICE_TOKEN_COOKIE, "" )
                             .httpOnly( true )
                             .path( DeviceTokenCookieService.COOKIE_PATH )
                             .maxAge( Duration.ZERO )
                             .build();
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

    private ResponseCookie accessTokenCookie() {
        return ResponseCookie.from( AccessTokenCookieService.ACCESS_TOKEN_COOKIE, "fresh-token" )
                             .httpOnly( true )
                             .maxAge( Duration.ofMinutes( 30 ) )
                             .build();
    }

    private ResponseCookie expiredAccessTokenCookie() {
        return ResponseCookie.from( AccessTokenCookieService.ACCESS_TOKEN_COOKIE, "" )
                             .httpOnly( true )
                             .maxAge( Duration.ZERO )
                             .build();
    }
}
