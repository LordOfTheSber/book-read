package com.library.tracker.web.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Slf4j
public class RequestOutcomeLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long start = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
            logOutcome(request, response, null, start);
        } catch (Exception ex) {
            logOutcome(request, response, ex, start);
            throw ex;
        }
    }

    private void logOutcome(
            HttpServletRequest request, HttpServletResponse response, Exception exception, long startTime) {
        long duration = System.currentTimeMillis() - startTime;
        int status = response.getStatus();
        if (exception != null && status < HttpStatus.BAD_REQUEST.value()) {
            status = HttpStatus.INTERNAL_SERVER_ERROR.value();
        }

        String method = request.getMethod();
        String path = request.getRequestURI();

        if (exception != null) {
            log.error("{} {} failed with status {} in {} ms", method, path, status, duration, exception);
        } else if (status >= HttpStatus.BAD_REQUEST.value()) {
            log.warn("{} {} completed with status {} in {} ms", method, path, status, duration);
        } else {
            log.info("{} {} completed with status {} in {} ms", method, path, status, duration);
        }
    }
}
