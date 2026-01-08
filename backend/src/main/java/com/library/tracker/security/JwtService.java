package com.library.tracker.security;

import com.library.tracker.domain.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    @Value( "${security.jwt.secret:change_this_secret_change_this_secret}" )
    private String secret;

    @Value( "${security.jwt.expiration-ms:86400000}" )
    private long expirationMs;

    private SecretKey signingKey;
    private JwtParser jwtParser;

    @PostConstruct
    void init() {
        this.signingKey = Keys.hmacShaKeyFor( secret.getBytes() );
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
}
