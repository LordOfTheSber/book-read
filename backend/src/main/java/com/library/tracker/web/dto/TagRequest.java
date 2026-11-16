package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class TagRequest {

    @NotBlank( message = "Tag name is required" )
    @Size( max = 64, message = "Tag name must be at most 64 characters" )
    private String name;

    @Size( max = 32, message = "Color must be at most 32 characters" )
    private String color;
}
