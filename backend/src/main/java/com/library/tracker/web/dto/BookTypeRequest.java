package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BookTypeRequest {

    @NotBlank( message = "Name is required" )
    private String name;
}
