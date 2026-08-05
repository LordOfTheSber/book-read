package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class SeriesRequest {

    @NotBlank( message = "Name is required" )
    @Size( max = 255, message = "Name must be at most 255 characters" )
    private String name;

    private String description;
}
