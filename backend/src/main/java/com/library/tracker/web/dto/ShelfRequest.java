package com.library.tracker.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class ShelfRequest {

    @NotBlank( message = "Shelf name is required" )
    @Size( max = 128, message = "Shelf name must be at most 128 characters" )
    private String name;

    private String description;

    /**
     * Публичная полка видна по ссылке другим пользователям сервиса.
     * <p>
     * Имя в JSON задано явно по той же причине, что и в ответе: сеттер Lombok называется
     * {@code setPublic}, и присланное клиентом «isPublic» до него не доходило — полка
     * создавалась приватной, что бы ни стояло в переключателе.
     */
    @JsonProperty( "isPublic" )
    private boolean isPublic;
}
