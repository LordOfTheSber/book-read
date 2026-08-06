package com.library.tracker.web.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Тег внутри карточки произведения: без счётчиков и дат. */
@Value
@Builder
public class TagSummary {

    UUID id;
    String name;
    String color;
}
