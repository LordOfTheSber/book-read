package com.library.tracker.web.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Автор внутри карточки произведения: без счётчиков и дат. */
@Value
@Builder
public class AuthorSummary {

    UUID id;
    String name;
    String altName;
}
