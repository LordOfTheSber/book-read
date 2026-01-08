package com.library.tracker.web.dto;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Sort;

public record LibraryItemFilter(
        Optional<String> query,
        Optional<UUID> typeId,
        Optional<ReadingStatus> status,
        Optional<Boolean> favorite,
        Optional<BigDecimal> minRating,
        Optional<BigDecimal> maxRating,
        Optional<OffsetDateTime> createdFrom,
        Optional<OffsetDateTime> createdTo,
        Optional<OffsetDateTime> updatedFrom,
        Optional<OffsetDateTime> updatedTo,
        Optional<MediaKind> kind,
        Optional<UUID> userId,
        int page,
        int size,
        Sort sort
) { }
