package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

import lombok.Data;

/** Кого присоединяют: записи уходящего переподвешиваются на того, чей идентификатор в пути. */
@Data
public class MergeRequest {

    @NotNull
    private UUID sourceId;
}
