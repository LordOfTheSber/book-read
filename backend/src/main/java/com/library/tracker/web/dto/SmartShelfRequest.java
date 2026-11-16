package com.library.tracker.web.dto;

import com.library.tracker.domain.SavedFilter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class SmartShelfRequest {

    @NotBlank( message = "Smart shelf name is required" )
    @Size( max = 128, message = "Smart shelf name must be at most 128 characters" )
    private String name;

    private String description;

    /** Сам фильтр: состав полки пересчитывается по нему при каждом открытии. */
    private SavedFilter filter = new SavedFilter();
}
