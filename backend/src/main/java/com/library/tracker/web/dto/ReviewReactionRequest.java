package com.library.tracker.web.dto;

import com.library.tracker.domain.ReactionKind;
import jakarta.validation.constraints.NotNull;

import lombok.Data;

@Data
public class ReviewReactionRequest {

    @NotNull( message = "Не указан вид реакции" )
    private ReactionKind kind;
}
