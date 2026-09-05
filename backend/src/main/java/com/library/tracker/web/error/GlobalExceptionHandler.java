package com.library.tracker.web.error;

import jakarta.validation.ConstraintViolationException;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

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

    /**
     * Неверные учётные данные — это отказ, а не поломка сервера: без своего обработчика они
     * доезжали до общего и превращались в 500, из-за чего обычная опечатка в пароле выглядела
     * в мониторинге как инцидент.
     * <p>
     * Сообщение одно на все случаи: «нет такого логина» и «пароль не подошёл» — разные ответы
     * только для того, кто подбирает, и по ним он отделяет существующие учётные записи.
     */
    @ExceptionHandler( AuthenticationException.class )
    public ResponseEntity<ApiError> handleAuthentication( AuthenticationException ex ) {
        return build( HttpStatus.UNAUTHORIZED, "Неверный логин или пароль", Collections.emptyList(), ex );
    }

    @ExceptionHandler( IllegalArgumentException.class )
    public ResponseEntity<ApiError> handleIllegalArgument( IllegalArgumentException ex ) {
        return build( HttpStatus.BAD_REQUEST, ex.getMessage(), Collections.emptyList(), ex );
    }

    @ExceptionHandler( IllegalStateException.class )
    public ResponseEntity<ApiError> handleIllegalState( IllegalStateException ex ) {
        return build( HttpStatus.CONFLICT, ex.getMessage(), Collections.emptyList(), ex );
    }

    /**
     * Файл больше разрешённого. Без своего обработчика отказ доезжал до общего и выглядел как
     * поломка сервера, хотя это ровно тот случай, когда клиенту надо назвать предел.
     */
    @ExceptionHandler( MaxUploadSizeExceededException.class )
    public ResponseEntity<ApiError> handleUploadTooLarge( MaxUploadSizeExceededException ex ) {
        return build( HttpStatus.PAYLOAD_TOO_LARGE, "Файл слишком большой", Collections.emptyList(), ex );
    }

    @ExceptionHandler( MissingServletRequestPartException.class )
    public ResponseEntity<ApiError> handleMissingPart( MissingServletRequestPartException ex ) {
        return build( HttpStatus.BAD_REQUEST, "Файл не выбран", Collections.emptyList(), ex );
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
        if ( status.is5xxServerError() ) {
            log.error( "{}: {}", status, message, ex );
        } else {
            // Ошибка клиента — не повод писать в лог стек и, главное, содержимое запроса:
            // у отказа валидации внутри лежит отвергнутое значение, то есть пароль как он есть.
            // В лог идут только наши собственные формулировки.
            log.warn( "{}: {} {}", status, message, details );
        }
        ApiError error = ApiError.builder()
                                 .timestamp( OffsetDateTime.now() )
                                 .message( message )
                                 .details( details )
                                 .build();
        return ResponseEntity.status( status ).body( error );
    }
}
