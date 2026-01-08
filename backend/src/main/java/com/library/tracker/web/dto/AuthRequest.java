package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class AuthRequest {

    @NotBlank
    @Size( min = 3, max = 32 )
    @Pattern( regexp = "^[A-Za-z0-9._-]+$", message = "Логин может содержать буквы, цифры, точку, тире и подчёркивание" )
    private String username;

    @NotBlank
    @Size( min = 8, max = 64 )
    @Pattern( regexp = "^(?=.*[A-Za-z])(?=.*\\d)[\\S]+$",
            message = "Пароль должен быть без пробелов и содержать буквы и цифры" )
    private String password;
}
