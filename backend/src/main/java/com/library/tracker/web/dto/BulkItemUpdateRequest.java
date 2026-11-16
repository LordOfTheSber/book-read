package com.library.tracker.web.dto;

import com.library.tracker.domain.ReadingStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

import lombok.Data;

/**
 * Массовая правка: проставить статус или тег сразу нескольким записям. Null значит «не трогать» —
 * поэтому обёртка {@code Boolean}, а не примитив: иначе «не трогать избранное» было бы неотличимо
 * от «снять избранное».
 */
@Data
public class BulkItemUpdateRequest {

    @NotEmpty( message = "Item ids are required" )
    @Size( max = 500, message = "At most 500 items can be updated at once" )
    private List<UUID> itemIds;

    private ReadingStatus status;

    private Boolean favorite;

    private Boolean wishlist;

    /** Теги добавляются по именам — так же, как в карточке; незнакомое имя заводится. */
    private List<String> addTagNames;

    private List<UUID> removeTagIds;

    private UUID typeId;

    private UUID addToShelfId;

    private UUID removeFromShelfId;
}
