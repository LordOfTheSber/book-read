package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotNull;

import lombok.Data;

@Data
public class UpdateUserBlockRequest {

    @NotNull
    private Boolean blocked;
}
