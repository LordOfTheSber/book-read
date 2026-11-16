package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

import lombok.Data;

/** Добавление и снятие с полки идут пачкой: по одной записи полку не собирают. */
@Data
public class ShelfItemsRequest {

    @NotEmpty( message = "Item ids are required" )
    private List<UUID> itemIds;
}
