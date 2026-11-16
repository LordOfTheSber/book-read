package com.library.tracker.web.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Полка внутри карточки произведения: без описания, состава и счётчиков. */
@Value
@Builder
public class ShelfSummary {

    UUID id;
    String name;
}
