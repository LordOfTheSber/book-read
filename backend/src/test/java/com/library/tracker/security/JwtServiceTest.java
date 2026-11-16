package com.library.tracker.security;

import com.library.tracker.domain.User;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String STRONG_SECRET = "Zm9vYmFyLXNlY3JldC13aXRoLWVub3VnaC1lbnRyb3B5LTEyMw==";

    @Test
    void failsFastInProdWhenSecretIsMissing() {
        JwtService service = jwtService( "", "prod" );

        assertThatThrownBy( service::init )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "SECURITY_JWT_SECRET" );
    }

    @Test
    void rejectsSecretPublishedInRepository() {
        JwtService service = jwtService( "change_this_secret_change_this_secret", "prod" );

        assertThatThrownBy( service::init )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "скомпрометированным" );
    }

    @Test
    void rejectsSecretShorterThanKeyLength() {
        JwtService service = jwtService( "too-short", "prod" );

        assertThatThrownBy( service::init )
                .isInstanceOf( IllegalStateException.class )
                .hasMessageContaining( "короче" );
    }

    @Test
    void startsWithEphemeralSecretOutsideProd() {
        JwtService service = jwtService( "" );

        assertThatCode( service::init ).doesNotThrowAnyException();

        String token = service.generateToken( user( "alex" ) );
        assertThat( service.isTokenValid( token ) ).isTrue();
        assertThat( service.extractUsername( token ) ).isEqualTo( "alex" );
    }

    @Test
    void issuesTokenWithConfiguredSecret() {
        JwtService service = jwtService( STRONG_SECRET, "prod" );
        service.init();

        String token = service.generateToken( user( "alex" ) );

        assertThat( service.isTokenValid( token ) ).isTrue();
        assertThat( service.extractUsername( token ) ).isEqualTo( "alex" );
    }

    @Test
    void rejectsExpiredToken() {
        JwtService service = jwtService( STRONG_SECRET, "prod" );
        ReflectionTestUtils.setField( service, "expirationMs", -1000L );
        service.init();

        assertThat( service.isTokenValid( service.generateToken( user( "alex" ) ) ) ).isFalse();
    }

    @Test
    void rejectsTokenSignedWithAnotherSecret() {
        JwtService issuer = jwtService( STRONG_SECRET, "prod" );
        issuer.init();
        JwtService verifier = jwtService( "b3RoZXItc2VjcmV0LXdpdGgtZW5vdWdoLWVudHJvcHktMTIzNA==", "prod" );
        verifier.init();

        assertThat( verifier.isTokenValid( issuer.generateToken( user( "alex" ) ) ) ).isFalse();
    }

    private JwtService jwtService( String secret, String... profiles ) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles( profiles );
        JwtService service = new JwtService( environment );
        ReflectionTestUtils.setField( service, "secret", secret );
        ReflectionTestUtils.setField( service, "expirationMs", 1_800_000L );
        return service;
    }

    private User user( String username ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( username );
        return user;
    }
}
