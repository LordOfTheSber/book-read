package com.library.tracker.web.dto;

import jakarta.validation.constraints.Size;

import lombok.Data;

/** Правка своего профиля. Логин не меняется: он в адресе профиля и в аутентификации. */
@Data
public class ProfileUpdateRequest {

    @Size( max = 128, message = "Имя не длиннее 128 символов" )
    private String displayName;

    @Size( max = 2000, message = "Описание не длиннее 2000 символов" )
    private String bio;

    private boolean publicProfile;
}
