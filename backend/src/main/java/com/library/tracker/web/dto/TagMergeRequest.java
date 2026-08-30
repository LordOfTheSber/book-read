package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/** Куда переезжают пометки объединяемого тега. Сам он после объединения исчезает. */
@Getter
@Setter
public class TagMergeRequest {

    @NotNull( message = "Не указан тег, в который объединять" )
    private UUID targetId;
}
