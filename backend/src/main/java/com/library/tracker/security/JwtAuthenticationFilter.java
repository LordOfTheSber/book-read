package com.library.tracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.library.tracker.service.UserService;
import com.library.tracker.service.SessionService;
import com.library.tracker.domain.Session;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserService userService;
    private final SessionService sessionService;
    private final AccessTokenCookieService accessTokenCookieService;

    private static final String AUTH_PATH = "/api/v1/auth";

    /**
     * Сравнение именно по границе сегмента пути. Простое {@code startsWith("/api/v1/auth")}
     * захватывало и {@code /api/v1/authors}: справочник авторов оставался без аутентификации
     * и отвечал 401 даже владельцу.
     */
    private boolean isAuthEndpoint( String uri ) {
        return uri.equals( AUTH_PATH ) || uri.startsWith( AUTH_PATH + "/" );
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain )
            throws ServletException, IOException {
        if ( isAuthEndpoint( request.getRequestURI() ) ) {
            filterChain.doFilter( request, response );
            return;
        }
        Optional<String> presentedToken = accessTokenCookieService.extract( request.getCookies() )
                .or( () -> accessTokenCookieService.extractFromHeader( request.getHeader( HttpHeaders.AUTHORIZATION ) ) );
        if ( presentedToken.isEmpty() ) {
            filterChain.doFilter( request, response );
            return;
        }
        String token = presentedToken.get();
        if ( !jwtService.isTokenValid( token ) ) {
            filterChain.doFilter( request, response );
            return;
        }
        String username = jwtService.extractUsername( token );
        Optional<UUID> sessionId = sessionService.extractSessionId( request.getCookies() );
        Optional<Session> activeSession = sessionId.flatMap( id -> sessionService.validateAndRefresh( id, username ) );
        if ( activeSession.isEmpty() ) {
            response.setStatus( HttpServletResponse.SC_UNAUTHORIZED );
            return;
        }
        Session session = activeSession.get();
        response.addHeader( HttpHeaders.SET_COOKIE, sessionService.buildCookie( session ).toString() );

        if ( SecurityContextHolder.getContext().getAuthentication() == null ) {
            UserDetails userDetails = userService.loadUserByUsername( username );
            if ( !userDetails.isAccountNonLocked() || !userDetails.isEnabled() ) {
                response.setStatus( HttpServletResponse.SC_FORBIDDEN );
                return;
            }
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken( userDetails, null, userDetails.getAuthorities() );
            authentication.setDetails( new WebAuthenticationDetailsSource().buildDetails( request ) );
            SecurityContextHolder.getContext().setAuthentication( authentication );
        }
        filterChain.doFilter( request, response );
    }
}
