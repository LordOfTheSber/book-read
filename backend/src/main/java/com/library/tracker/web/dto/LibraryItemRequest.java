package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.util.UUID;

import lombok.Data;

@Data
public class LibraryItemRequest {

    private MediaKind kind = MediaKind.BOOK;

    @NotBlank( message = "Title is required" )
    private String title;

    private String altTitle;

    private UUID typeId;

    private String comment;

    @DecimalMin( value = "0.0", message = "Rating must be at least 0" )
    @DecimalMax( value = "10.0", message = "Rating must be at most 10" )
    @Digits( integer = 2, fraction = 1, message = "Rating must have at most one decimal place" )
    private BigDecimal rating;

    private boolean favorite;

    private ReadingStatus status = ReadingStatus.PLANNED;
}
