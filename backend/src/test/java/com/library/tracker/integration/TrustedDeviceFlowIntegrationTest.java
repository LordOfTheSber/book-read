package com.library.tracker.integration;

import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.DeviceTokenCookieService;
import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.DeviceHintResponse;
import com.library.tracker.web.dto.DeviceLoginRequest;
import com.library.tracker.web.dto.RegisterRequest;
import com.library.tracker.web.dto.TrustedDeviceResponse;
import com.library.tracker.web.dto.UserResponse;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/** Сквозная проверка быстрого входа: запомнить устройство → войти без пароля → забыть его. */
@SpringBootTest( webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT )
class TrustedDeviceFlowIntegrationTest extends PostgresContainerTest {

    private static final String FINGERPRINT = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void rememberedDeviceLogsInWithoutPassword() {
        ResponseEntity<AuthResponse> registered = register( "deviceuser", true );
        assertThat( registered.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( registered.getBody() ).isNotNull();
        assertThat( registered.getBody().isDeviceRemembered() ).isTrue();

        String deviceCookie = cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );
        assertThat( deviceCookie ).isNotEmpty();

        // Экран входа спрашивает, кого предлагать: пароля ещё не было, а имя уже известно.
        ResponseEntity<DeviceHintResponse> hint = get( "/api/v1/auth/device?fingerprint=" + FINGERPRINT,
                                                       DeviceHintResponse.class, deviceCookie );
        assertThat( hint.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( hint.getBody() ).isNotNull();
        assertThat( hint.getBody().getUsername() ).isEqualTo( "deviceuser" );

        ResponseEntity<AuthResponse> quickLogin = deviceLogin( FINGERPRINT, deviceCookie );
        assertThat( quickLogin.getStatusCode() ).isEqualTo( HttpStatus.OK );

        String sessionCookie = cookie( quickLogin.getHeaders(), SessionService.SESSION_COOKIE );
        String accessTokenCookie = cookie( quickLogin.getHeaders(), AccessTokenCookieService.ACCESS_TOKEN_COOKIE );
        assertThat( currentUser( sessionCookie, accessTokenCookie ).getStatusCode() ).isEqualTo( HttpStatus.OK );

        // Секрет сменился, и прежнее значение куки больше не работает: снятая когда-то копия
        // перестаёт давать вход, как только настоящее устройство им воспользуется.
        String rotated = cookie( quickLogin.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );
        assertThat( rotated ).isNotEmpty().isNotEqualTo( deviceCookie );
        assertThat( deviceLogin( FINGERPRINT, deviceCookie ).getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
        assertThat( deviceLogin( FINGERPRINT, rotated ).getStatusCode() ).isEqualTo( HttpStatus.OK );
    }

    /** Кука без совпадающего отпечатка входа не даёт: она опознаёт устройство только вместе с ним. */
    @Test
    void deviceCookieAloneIsNotEnough() {
        ResponseEntity<AuthResponse> registered = register( "fingerprintuser", true );
        String deviceCookie = cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );

        assertThat( deviceLogin( "another-device-fingerprint", deviceCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
        assertThat( get( "/api/v1/auth/device?fingerprint=another-device-fingerprint", DeviceHintResponse.class, deviceCookie )
                            .getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
    }

    /** Без явной просьбы устройство не запоминается: молчаливое доверие — это ключ в чужом браузере. */
    @Test
    void deviceIsNotRememberedUnlessAsked() {
        ResponseEntity<AuthResponse> registered = register( "passwordonlyuser", false );

        assertThat( registered.getBody() ).isNotNull();
        assertThat( registered.getBody().isDeviceRemembered() ).isFalse();
        assertThat( cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE ) ).isEmpty();
    }

    /** «Это не я» на экране входа: доверие снимается, и следующий быстрый вход не проходит. */
    @Test
    void forgottenDeviceStopsLoggingIn() {
        ResponseEntity<AuthResponse> registered = register( "forgetuser", true );
        String deviceCookie = cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );

        ResponseEntity<Void> forgotten = restTemplate.exchange( "/api/v1/auth/device", HttpMethod.DELETE,
                                                                new HttpEntity<>( headers( deviceCookie ) ),
                                                                Void.class );
        assertThat( forgotten.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        assertThat( deviceLogin( FINGERPRINT, deviceCookie ).getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    /** Выход гасит сессию, но доверие оставляет: вернуться можно кнопкой, а не паролем. */
    @Test
    void logoutKeepsDeviceTrust() {
        ResponseEntity<AuthResponse> registered = register( "logoutuser", true );
        String deviceCookie = cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );
        String sessionCookie = cookie( registered.getHeaders(), SessionService.SESSION_COOKIE );

        assertThat( post( "/api/v1/auth/logout", null, Void.class, sessionCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.NO_CONTENT );
        assertThat( deviceLogin( FINGERPRINT, deviceCookie ).getStatusCode() ).isEqualTo( HttpStatus.OK );
    }

    /** Список «мои устройства» показывает своё устройство и отключает его по идентификатору. */
    @Test
    void ownerSeesAndRevokesOwnDevices() {
        ResponseEntity<AuthResponse> registered = register( "listuser", true );
        String deviceCookie = cookie( registered.getHeaders(), DeviceTokenCookieService.DEVICE_TOKEN_COOKIE );
        String sessionCookie = cookie( registered.getHeaders(), SessionService.SESSION_COOKIE );
        String accessTokenCookie = cookie( registered.getHeaders(), AccessTokenCookieService.ACCESS_TOKEN_COOKIE );

        ResponseEntity<List<TrustedDeviceResponse>> devices = restTemplate.exchange(
                "/api/v1/account/devices?fingerprint=" + FINGERPRINT, HttpMethod.GET,
                new HttpEntity<>( headers( sessionCookie, accessTokenCookie ) ),
                new ParameterizedTypeReference<>() {} );

        assertThat( devices.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( devices.getBody() ).hasSize( 1 );
        assertThat( devices.getBody().get( 0 ).isCurrent() ).isTrue();

        ResponseEntity<Void> revoked = restTemplate.exchange(
                "/api/v1/account/devices/" + devices.getBody().get( 0 ).getId(), HttpMethod.DELETE,
                new HttpEntity<>( headers( sessionCookie, accessTokenCookie ) ), Void.class );

        assertThat( revoked.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );
        assertThat( deviceLogin( FINGERPRINT, deviceCookie ).getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    /** Кука устройства не должна ездить в каждый запрос: её путь ограничен ветвью входа. */
    @Test
    void deviceCookieIsHttpOnlyAndScopedToAuth() {
        ResponseEntity<AuthResponse> registered = register( "scopeuser", true );

        String setCookie = registered.getHeaders().getOrEmpty( HttpHeaders.SET_COOKIE ).stream()
                                     .filter( value -> value.startsWith(
                                             DeviceTokenCookieService.DEVICE_TOKEN_COOKIE + "=" ) )
                                     .findFirst()
                                     .orElse( "" );

        assertThat( setCookie ).contains( "HttpOnly" )
                               .contains( "SameSite=Lax" )
                               .contains( "Path=" + DeviceTokenCookieService.COOKIE_PATH );
    }

    private ResponseEntity<AuthResponse> register( String username, boolean rememberDevice ) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername( username );
        request.setPassword( "Password123" );
        request.setRememberDevice( rememberDevice );
        request.setDeviceFingerprint( FINGERPRINT );
        return post( "/api/v1/auth/register", request, AuthResponse.class );
    }

    private ResponseEntity<AuthResponse> deviceLogin( String fingerprint, String deviceCookie ) {
        DeviceLoginRequest request = new DeviceLoginRequest();
        request.setFingerprint( fingerprint );
        return post( "/api/v1/auth/device/login", request, AuthResponse.class, deviceCookie );
    }

    private ResponseEntity<UserResponse> currentUser( String... cookies ) {
        return restTemplate.exchange( "/api/v1/users/me", HttpMethod.GET, new HttpEntity<>( headers( cookies ) ),
                                      UserResponse.class );
    }

    private <T> ResponseEntity<T> get( String path, Class<T> responseType, String... cookies ) {
        return restTemplate.exchange( path, HttpMethod.GET, new HttpEntity<>( headers( cookies ) ), responseType );
    }

    private <T> ResponseEntity<T> post( String path, Object body, Class<T> responseType, String... cookies ) {
        return restTemplate.exchange( path, HttpMethod.POST, new HttpEntity<>( body, headers( cookies ) ),
                                      responseType );
    }

    private HttpHeaders headers( String... cookies ) {
        HttpHeaders headers = new HttpHeaders();
        List<String> present = Stream.of( cookies ).filter( value -> value != null && !value.isBlank() ).toList();
        if ( !present.isEmpty() ) {
            headers.add( HttpHeaders.COOKIE, String.join( "; ", present ) );
        }
        return headers;
    }

    /** Из заголовка ответа берём только пару «имя=значение», без атрибутов вроде Path и Max-Age. */
    private String cookie( HttpHeaders headers, String name ) {
        return headers.getOrEmpty( HttpHeaders.SET_COOKIE ).stream()
                      .filter( value -> value.startsWith( name + "=" ) )
                      .map( value -> value.split( ";", 2 )[0] )
                      .filter( value -> !value.equals( name + "=" ) )
                      .findFirst()
                      .orElse( "" );
    }
}
