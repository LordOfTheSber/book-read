package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

import lombok.Data;

@Data
public class AuthorMergeRequest {

    /** Автор, к которому переезжают произведения дубля; сам дубль после слияния удаляется. */
    @NotNull
    private UUID targetId;
}
