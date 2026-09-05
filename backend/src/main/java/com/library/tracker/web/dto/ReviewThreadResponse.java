package com.library.tracker.web.dto;

import com.library.tracker.domain.ReactionKind;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Обсуждение отзыва: счётчики реакций, своя реакция и плоский список комментариев. */
@Value
@Builder
public class ReviewThreadResponse {

    UUID itemId;
    Map<ReactionKind, Long> reactions;
    ReactionKind myReaction;
    List<ReviewCommentResponse> comments;
}
