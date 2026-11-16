package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

import lombok.Data;

/** Что удалить пачкой. Граница та же, что у массовой правки: полтысячи записей за раз. */
@Data
public class BulkItemDeleteRequest {

    @NotEmpty( message = "Item ids are required" )
    @Size( max = 500, message = "At most 500 items can be deleted at once" )
    private List<UUID> itemIds;
}
