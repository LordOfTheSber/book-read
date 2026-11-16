package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Data;

/**
 * Смена собственного пароля. Текущий спрашивается по той же причине, что и при удалении аккаунта:
 * открытая сессия — это ещё и чужой ноутбук, оставленный разблокированным.
 * <p>
 * Требования к новому паролю те же, что при регистрации: разные правила в двух местах означали бы,
 * что часть паролей нельзя задать заново.
 */
@Data
public class PasswordChangeRequest {

    @NotBlank( message = "Введите текущий пароль" )
    private String currentPassword;

    @NotBlank( message = "Введите новый пароль" )
    @Size( min = 8, max = 64, message = "Пароль должен быть от 8 до 64 символов" )
    @Pattern( regexp = "^(?=.*[A-Za-z])(?=.*\\d)[\\S]+$",
            message = "Пароль должен быть без пробелов и содержать буквы и цифры" )
    private String newPassword;
}
