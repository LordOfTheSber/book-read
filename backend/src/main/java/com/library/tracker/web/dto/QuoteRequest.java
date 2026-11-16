package com.library.tracker.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class QuoteRequest {

    @Min( value = 0, message = "Position must be at least 0" )
    private Integer position;

    @NotBlank( message = "Text is required" )
    @Size( max = 10000, message = "Quote must be at most 10000 characters" )
    private String text;

    @Size( max = 2000, message = "Note must be at most 2000 characters" )
    private String note;
}
