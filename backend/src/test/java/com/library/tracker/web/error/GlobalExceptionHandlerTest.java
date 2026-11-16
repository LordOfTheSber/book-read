package com.library.tracker.web.error;

import com.library.tracker.web.dto.AuthRequest;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    /**
     * Неверный пароль — это отказ, а не поломка сервера. Без своего обработчика он доезжал до
     * общего и превращался в 500: обычная опечатка выглядела в мониторинге как инцидент.
     */
    @Test
    void badCredentialsAnswerUnauthorized() {
        ResponseEntity<ApiError> response =
                handler.handleAuthentication( new BadCredentialsException( "Неверные учетные данные пользователя" ) );

        assertThat( response.getStatusCode() ).isEqualTo( HttpStatus.UNAUTHORIZED );
    }

    /**
     * Ответ одинаков и для несуществующего логина, и для неподошедшего пароля: разные ответы
     * помогают только тому, кто подбирает, — по ним он отделяет существующие учётные записи.
     */
    @Test
    void authenticationFailureDoesNotEchoTheReason() {
        ResponseEntity<ApiError> response =
                handler.handleAuthentication( new BadCredentialsException( "пароль kek не подошёл" ) );

        assertThat( response.getBody() ).isNotNull();
        assertThat( response.getBody().getMessage() ).isEqualTo( "Неверный логин или пароль" );
        assertThat( response.getBody().getDetails() ).isEmpty();
    }

    /**
     * Вход не проверяет форму пароля. Иначе тот, чей пароль заведён до появления политики, не
     * войдёт со своим настоящим паролем, ответ подскажет подбирающему форму пароля, а отказ
     * валидации уедет в лог вместе с отвергнутым значением — то есть с самим паролем.
     */
    @Test
    void loginAcceptsAnyNonBlankPassword() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

        AuthRequest request = new AuthRequest();
        request.setUsername( "reader" );
        request.setPassword( "kek" );

        assertThat( validator.validate( request ) ).isEmpty();
    }

    @Test
    void loginStillRejectsBlankCredentials() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

        AuthRequest request = new AuthRequest();
        request.setUsername( "  " );
        request.setPassword( "" );

        assertThat( validator.validate( request ) ).hasSize( 2 );
    }
}
