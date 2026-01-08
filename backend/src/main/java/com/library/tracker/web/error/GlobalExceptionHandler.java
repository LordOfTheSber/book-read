package com.library.tracker.web.error;

import jakarta.validation.ConstraintViolationException;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler( MethodArgumentNotValidException.class )
    public ResponseEntity<ApiError> handleValidation( MethodArgumentNotValidException ex ) {
        List<String> details = ex.getBindingResult().getFieldErrors().stream()
                                 .map( FieldError::getDefaultMessage )
                                 .toList();
        return build( HttpStatus.BAD_REQUEST, "Validation failed", details, ex );
    }

    @ExceptionHandler( ConstraintViolationException.class )
    public ResponseEntity<ApiError> handleConstraint( ConstraintViolationException ex ) {
        return build( HttpStatus.BAD_REQUEST, "Validation failed",
                      ex.getConstraintViolations().stream().map( v -> v.getMessage() ).toList(), ex );
    }

    @ExceptionHandler( IllegalArgumentException.class )
    public ResponseEntity<ApiError> handleIllegalArgument( IllegalArgumentException ex ) {
        return build( HttpStatus.BAD_REQUEST, ex.getMessage(), Collections.emptyList(), ex );
    }

    @ExceptionHandler( IllegalStateException.class )
    public ResponseEntity<ApiError> handleIllegalState( IllegalStateException ex ) {
        return build( HttpStatus.CONFLICT, ex.getMessage(), Collections.emptyList(), ex );
    }

    @ExceptionHandler( AccessDeniedException.class )
    public ResponseEntity<ApiError> handleAccessDenied( AccessDeniedException ex ) {
        return build( HttpStatus.FORBIDDEN, ex.getMessage(), Collections.emptyList(), ex );
    }

    @ExceptionHandler( Exception.class )
    public ResponseEntity<ApiError> handleGeneric( Exception ex ) {
        return build( HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), Collections.emptyList(), ex );
    }

    private ResponseEntity<ApiError> build( HttpStatus status, String message, List<String> details, Exception ex ) {
        log.error( "{}: {}", status, message, ex );
        ApiError error = ApiError.builder()
                                 .timestamp( OffsetDateTime.now() )
                                 .message( message )
                                 .details( details )
                                 .build();
        return ResponseEntity.status( status ).body( error );
    }
}
