package com.library.tracker.integration;

import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.RegisterRequest;
import com.library.tracker.web.dto.UserResponse;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/** Сквозная проверка жизненного цикла сессии: регистрация → обновление токена → выход. */
@SpringBootTest( webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT )
class AuthFlowIntegrationTest extends PostgresContainerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void refreshIssuesTokenAndLogoutEndsSession() {
        ResponseEntity<AuthResponse> registered = register( "flowuser" );
        assertThat( registered.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( registered.getBody() ).isNotNull();

        String sessionCookie = cookie( registered.getHeaders(), SessionService.SESSION_COOKIE );
        String accessTokenCookie = cookie( registered.getHeaders(), AccessTokenCookieService.ACCESS_TOKEN_COOKIE );
        assertThat( sessionCookie ).isNotEmpty();
        assertThat( accessTokenCookie ).isNotEmpty();

        assertThat( currentUser( sessionCookie, accessTokenCookie ).getStatusCode() ).isEqualTo( HttpStatus.OK );

        ResponseEntity<AuthResponse> refreshed = post( "/api/v1/auth/refresh", null, AuthResponse.class,
                                                       sessionCookie );
        assertThat( refreshed.getStatusCode() ).isEqualTo( HttpStatus.OK );

        String refreshedAccessTokenCookie = cookie( refreshed.getHeaders(),
                                                    AccessTokenCookieService.ACCESS_TOKEN_COOKIE );
        assertThat( refreshedAccessTokenCookie ).isNotEmpty();
        assertThat( currentUser( sessionCookie, refreshedAccessTokenCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.OK );

        ResponseEntity<Void> loggedOut = post( "/api/v1/auth/logout", null, Void.class, sessionCookie );
        assertThat( loggedOut.getStatusCode() ).isEqualTo( HttpStatus.NO_CONTENT );

        assertThat( post( "/api/v1/auth/refresh", null, AuthResponse.class, sessionCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
        assertThat( currentUser( sessionCookie, refreshedAccessTokenCookie ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    /** Токен уходит только httpOnly-кукой: в теле ответа его быть не должно. */
    @Test
    void registerKeepsAccessTokenOutOfResponseBody() {
        ResponseEntity<String> registered = restTemplate.exchange( "/api/v1/auth/register", HttpMethod.POST,
                                                                   new HttpEntity<>( registerRequest( "bodyless" ),
                                                                                     new HttpHeaders() ),
                                                                   String.class );

        assertThat( registered.getStatusCode() ).isEqualTo( HttpStatus.OK );
        assertThat( registered.getBody() ).doesNotContain( "\"token\"" );
        assertThat( cookie( registered.getHeaders(), AccessTokenCookieService.ACCESS_TOKEN_COOKIE ) ).isNotEmpty();
    }

    /** Кука с токеном должна быть httpOnly — иначе она снова доступна XSS. */
    @Test
    void accessTokenCookieIsHttpOnly() {
        ResponseEntity<AuthResponse> registered = register( "httponlyuser" );

        String setCookie = registered.getHeaders().getOrEmpty( HttpHeaders.SET_COOKIE ).stream()
                                     .filter( value -> value.startsWith(
                                             AccessTokenCookieService.ACCESS_TOKEN_COOKIE + "=" ) )
                                     .findFirst()
                                     .orElse( "" );

        assertThat( setCookie ).contains( "HttpOnly" ).contains( "SameSite=Lax" );
    }

    @Test
    void refreshWithoutSessionCookieIsRejected() {
        assertThat( post( "/api/v1/auth/refresh", null, AuthResponse.class ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    @Test
    void logoutWithoutSessionCookieSucceeds() {
        assertThat( post( "/api/v1/auth/logout", null, Void.class ).getStatusCode() )
                .isEqualTo( HttpStatus.NO_CONTENT );
    }

    /**
     * Фильтр пропускает без проверки только сам /api/v1/auth. Сравнение по префиксу строки
     * когда-то захватывало и /api/v1/authors: справочник авторов оставался анонимным и отвечал
     * 401 даже владельцу.
     */
    @Test
    void authorsEndpointIsAuthenticatedDespiteSharedPrefix() {
        ResponseEntity<AuthResponse> registered = register( "prefixuser" );
        String sessionCookie = cookie( registered.getHeaders(), SessionService.SESSION_COOKIE );
        String accessTokenCookie = cookie( registered.getHeaders(), AccessTokenCookieService.ACCESS_TOKEN_COOKIE );

        ResponseEntity<String> authors = restTemplate.exchange( "/api/v1/authors", HttpMethod.GET,
                                                                new HttpEntity<>( headers( sessionCookie,
                                                                                           accessTokenCookie ) ),
                                                                String.class );

        assertThat( authors.getStatusCode() ).isEqualTo( HttpStatus.OK );
    }

    @Test
    void protectedEndpointRejectsAnonymousWithUnauthorized() {
        assertThat( restTemplate.getForEntity( "/api/v1/items", String.class ).getStatusCode() )
                .isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    private ResponseEntity<AuthResponse> register( String username ) {
        return post( "/api/v1/auth/register", registerRequest( username ), AuthResponse.class );
    }

    private RegisterRequest registerRequest( String username ) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername( username );
        request.setPassword( "Password123" );
        return request;
    }

    private ResponseEntity<UserResponse> currentUser( String... cookies ) {
        return restTemplate.exchange( "/api/v1/users/me", HttpMethod.GET, new HttpEntity<>( headers( cookies ) ),
                                      UserResponse.class );
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
                      .filter( value -> !value.endsWith( "=" ) )
                      .findFirst()
                      .orElse( "" );
    }
}
