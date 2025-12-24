package com.library.tracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.library.tracker.service.UserService;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserService userService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain )
            throws ServletException, IOException {
        String authHeader = request.getHeader( "Authorization" );
        if ( authHeader != null && authHeader.startsWith( "Bearer " ) ) {
            String token = authHeader.substring( 7 );
            if ( jwtService.isTokenValid( token ) && SecurityContextHolder.getContext().getAuthentication() == null ) {
                String username = jwtService.extractUsername( token );
                UserDetails userDetails = userService.loadUserByUsername( username );
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken( userDetails, null, userDetails.getAuthorities() );
                authentication.setDetails( new WebAuthenticationDetailsSource().buildDetails( request ) );
                SecurityContextHolder.getContext().setAuthentication( authentication );
            }
        }
        filterChain.doFilter( request, response );
    }
}
