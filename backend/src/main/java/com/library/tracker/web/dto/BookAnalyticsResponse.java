package com.library.tracker.web.dto;

import com.library.tracker.domain.ReadingStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Value
@Builder
public class BookAnalyticsResponse {

    long totalItems;
    long favoriteItems;
    BigDecimal averageRating;
    Map<ReadingStatus, Long> statusBreakdown;
    List<TypeCountResponse> topTypes;
    List<SourceCountResponse> topSources;
}
