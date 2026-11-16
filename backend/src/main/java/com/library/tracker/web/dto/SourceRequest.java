package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;

import lombok.Data;

@Data
public class SourceRequest {

    @NotBlank( message = "Name is required" )
    private String name;

    @NotBlank( message = "Url is required" )
    private String url;

    private String description;
}
