package com.library.tracker.web.dto;

import java.time.LocalDate;

import lombok.Builder;
import lombok.Value;

/** Достижение вместе с тем, получено ли оно: закрытые показываются серыми, а не прячутся. */
@Value
@Builder
public class AchievementResponse {

    String code;
    String title;
    String description;
    boolean unlocked;
    LocalDate unlockedOn;
}
