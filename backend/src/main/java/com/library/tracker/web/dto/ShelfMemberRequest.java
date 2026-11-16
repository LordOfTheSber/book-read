package com.library.tracker.web.dto;

import com.library.tracker.domain.ShelfRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import lombok.Data;

/** Участник зовётся по логину: идентификатор чужого пользователя взять неоткуда, и не нужно. */
@Data
public class ShelfMemberRequest {

    @NotBlank( message = "Не указан пользователь" )
    private String username;

    @NotNull( message = "Не указана роль" )
    private ShelfRole role;
}
