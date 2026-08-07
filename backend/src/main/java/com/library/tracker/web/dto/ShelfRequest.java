package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class ShelfRequest {

    @NotBlank( message = "Shelf name is required" )
    @Size( max = 128, message = "Shelf name must be at most 128 characters" )
    private String name;

    private String description;

    /** Публичная полка видна по ссылке другим пользователям сервиса. */
    private boolean isPublic;
}
