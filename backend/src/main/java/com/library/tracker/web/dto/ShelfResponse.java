package com.library.tracker.web.dto;

import com.library.tracker.domain.ShelfRole;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ShelfResponse {

    UUID id;
    String name;
    String description;
    boolean isPublic;
    long itemCount;
    UUID ownerId;
    String ownerUsername;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    /** Роль спрашивающего внутри полки; у владельца и постороннего её нет. */
    ShelfRole myRole;
    boolean owned;
    /** Можно ли править саму полку и её состав целиком: владелец и куратор. */
    boolean canCurate;
    /** Можно ли класть на полку свои записи: сверх кураторов — участники-соавторы. */
    boolean canContribute;
    long memberCount;
}
