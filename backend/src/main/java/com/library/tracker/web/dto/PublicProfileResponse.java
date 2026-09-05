package com.library.tracker.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/** Страница {@code /u/username}: шапка, счётчики, открытые полки и последние отзывы. */
@Value
@Builder
public class PublicProfileResponse {

    UUID id;
    String username;
    String displayName;
    String bio;
    boolean hasAvatar;
    boolean publicProfile;
    /** Свой профиль открыт владельцу всегда, даже пока он закрыт для остальных. */
    boolean me;
    boolean followedByMe;
    long followerCount;
    long followingCount;
    long finishedCount;
    long reviewCount;
    BigDecimal averageRating;
    int currentStreak;
    long achievementCount;
    OffsetDateTime joinedAt;
    /** Сколько книг есть и у него, и у спрашивающего; в своём профиле — ноль. */
    long commonCount;
    List<ShelfResponse> shelves;
    List<PublicReviewResponse> reviews;
    /** Что читает прямо сейчас: обложками, без прогресса — чужой темп чтения не наше дело. */
    List<ShowcaseItemResponse> currentlyReading;
}
