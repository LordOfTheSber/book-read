package com.library.tracker.web.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import com.library.tracker.service.RequestMetricsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Component
@RequiredArgsConstructor
@Slf4j
public class RequestOutcomeLoggingFilter extends OncePerRequestFilter {

    private final RequestMetricsService requestMetricsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain )
            throws ServletException, IOException {
        long start = System.currentTimeMillis();
        try {
            filterChain.doFilter( request, response );
            logOutcome( request, response, null, start );
        } catch ( Exception ex ) {
            logOutcome( request, response, ex, start );
            throw ex;
        }
    }

    private void logOutcome(
            HttpServletRequest request, HttpServletResponse response, Exception exception, long startTime ) {
        long duration = System.currentTimeMillis() - startTime;
        int status = response.getStatus();
        if ( exception != null && status < HttpStatus.BAD_REQUEST.value() ) {
            status = HttpStatus.INTERNAL_SERVER_ERROR.value();
        }

        String method = request.getMethod();
        String path = request.getRequestURI();
        String metricsPath = resolveMetricsPath( request );

        if ( exception != null ) {
            log.error( "{} {} failed with status {} in {} ms", method, path, status, duration, exception );
        } else if ( status >= HttpStatus.BAD_REQUEST.value() ) {
            log.warn( "{} {} completed with status {} in {} ms", method, path, status, duration );
        } else {
            log.info( "{} {} completed with status {} in {} ms", method, path, status, duration );
        }

        requestMetricsService.recordRequest( method, metricsPath, status, duration );
    }

    private String resolveMetricsPath( HttpServletRequest request ) {
        Object pattern = request.getAttribute( HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE );
        if ( pattern instanceof String patternValue && !patternValue.isBlank() ) {
            return patternValue;
        }
        return normalizePath( request.getRequestURI() );
    }

    private String normalizePath( String path ) {
        if ( path == null || path.isBlank() ) {
            return "/";
        }
        String[] parts = path.split( "/" );
        StringBuilder result = new StringBuilder();
        for ( String part : parts ) {
            if ( part.isBlank() ) {
                continue;
            }
            result.append( '/' ).append( normalizeSegment( part ) );
        }
        return result.length() == 0 ? "/" : result.toString();
    }

    private String normalizeSegment( String segment ) {
        String lower = segment.toLowerCase();
        if ( lower.matches( "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" ) ) {
            return "{id}";
        }
        if ( segment.matches( "\\d+" ) ) {
            return "{id}";
        }
        if ( segment.contains( "." ) && segment.matches( ".*\\d.*" ) && segment.length() > 8 ) {
            return "{id}";
        }
        return segment;
    }
}
