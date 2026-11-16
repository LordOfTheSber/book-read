package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class ReviewCommentRequest {

    @NotBlank( message = "Комментарий не может быть пустым" )
    @Size( max = 2000, message = "Комментарий не длиннее 2000 символов" )
    private String body;
}
