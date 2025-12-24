package com.library.tracker.security;

import com.library.tracker.domain.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

import java.security.Key;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    @Value( "${security.jwt.secret:change_this_secret_change_this_secret}" )
    private String secret;

    @Value( "${security.jwt.expiration-ms:86400000}" )
    private long expirationMs;

    private Key signingKey;

    @PostConstruct
    void init() {
        this.signingKey = Keys.hmacShaKeyFor( secret.getBytes() );
    }

    public String generateToken( User user ) {
        Date now = new Date();
        Date expiry = new Date( now.getTime() + expirationMs );
        return Jwts.builder()
                   .setSubject( user.getUsername() )
                   .setIssuedAt( now )
                   .setExpiration( expiry )
                   .signWith( signingKey, SignatureAlgorithm.HS256 )
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
        return Jwts.parserBuilder()
                   .setSigningKey( signingKey )
                   .build()
                   .parseClaimsJws( token )
                   .getBody();
    }
}
