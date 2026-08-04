package com.library.tracker.integration;

import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.RegisterRequest;
import com.library.tracker.web.dto.UserResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;

import static org.assertj.core.api.Assertions.assertThat;

/** Сквозная проверка жизненного цикла сессии: регистрация → обновление токена → выход. */
@SpringBootTest( webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT )
class AuthFlowIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void refreshIssuesTokenAndLogoutEndsSession() {
        ResponseEntity<AuthResponse> registered = register( "flowuser" );
        assertThat( registered.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( registered.getBody() ).isNotNull();

        String sessionCookie = sessionCookie( registered.getHeaders() );
        assertThat( sessionCookie ).isNotEmpty();
        String token = registered.getBody().getToken();

        assertThat( currentUser( token, sessionCookie ).getStatusCode() ).isEqualTo( HttpStatus.OK );

        ResponseEntity<AuthResponse> refreshed = post( "/api/v1/auth/refresh", null, sessionCookie,
                                                       AuthResponse.class );
        assertThat( refreshed.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( refreshed.getBody() ).isNotNull();
        assertThat( refreshed.getBody().getToken() ).isNotBlank();

        String refreshedToken = refreshed.getBody().getToken();
        assertThat( currentUser( refreshedToken, sessionCookie ).getStatusCode() ).isEqualTo( HttpStatus.OK );

        ResponseEntity<Void> loggedOut = post( "/api/v1/auth/logout", null, sessionCookie, Void.class );
        assertThat( loggedOut.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );

        assertThat( post( "/api/v1/auth/refresh", null, sessionCookie, AuthResponse.class ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
        assertThat( currentUser( refreshedToken, sessionCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    @Test
    void refreshWithoutSessionCookieIsRejected() {
        assertThat( post( "/api/v1/auth/refresh", null, null, AuthResponse.class ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    @Test
    void logoutWithoutSessionCookieSucceeds() {
        assertThat( post( "/api/v1/auth/logout", null, null, Void.class ).getStatusCode() )
                .isEqualTo( HttpStatus.NO_CONTENT );
    }

    @Test
    void protectedEndpointRejectsAnonymousWithUnauthorized() {
        assertThat( restTemplate.getForEntity( "/api/v1/items", String.class ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    private ResponseEntity<AuthResponse> register( String username ) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername( username );
        request.setPassword( "Password123" );
        return post( "/api/v1/auth/register", request, null, AuthResponse.class );
    }

    private ResponseEntity<UserResponse> currentUser( String token, String sessionCookie ) {
        HttpHeaders headers = headers( sessionCookie );
        headers.setBearerAuth( token );
        return restTemplate.exchange( "/api/v1/users/me", HttpMethod.GET, new HttpEntity<>( headers ),
                                      UserResponse.class );
    }

    private <T> ResponseEntity<T> post( String path, Object body, String sessionCookie, Class<T> responseType ) {
        return restTemplate.exchange( path, HttpMethod.POST, new HttpEntity<>( body, headers( sessionCookie ) ),
                                      responseType );
    }

    private HttpHeaders headers( String sessionCookie ) {
        HttpHeaders headers = new HttpHeaders();
        if ( StringUtils.hasText( sessionCookie ) ) {
            headers.add( HttpHeaders.COOKIE, sessionCookie );
        }
        return headers;
    }

    /** Из заголовка ответа берём только пару «имя=значение», без атрибутов вроде Path и Max-Age. */
    private String sessionCookie( HttpHeaders headers ) {
        return headers.getOrEmpty( HttpHeaders.SET_COOKIE ).stream()
                      .filter( value -> value.startsWith( SessionService.SESSION_COOKIE + "=" ) )
                      .map( value -> value.split( ";", 2 )[0] )
                      .findFirst()
                      .orElse( "" );
    }
}
