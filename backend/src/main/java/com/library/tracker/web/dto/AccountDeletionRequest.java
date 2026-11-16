package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Подтверждение удаления аккаунта. Пароль спрашивается заново: открытая сессия — это ещё и чужой
 * ноутбук, оставленный разблокированным.
 */
@Data
public class AccountDeletionRequest {

    @NotBlank( message = "Подтвердите удаление паролем" )
    private String password;
}
