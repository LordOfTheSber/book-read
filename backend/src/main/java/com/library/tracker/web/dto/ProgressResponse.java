package com.library.tracker.web.dto;

import com.library.tracker.domain.ProgressUnit;

import lombok.Builder;
import lombok.Value;

/**
 * Прогресс в удобном для отображения виде: сама шкала плюс то, что из неё считается —
 * процент, остаток и норма в день до дедлайна.
 */
@Value
@Builder
public class ProgressResponse {

    Integer current;
    Integer total;
    ProgressUnit unit;
    /** null, если шкала не задана: рисовать полосу не из чего. */
    Integer percent;
    Integer remaining;
    /** Сколько нужно проходить в день, чтобы успеть к дедлайну. */
    Integer dailyNorm;
    Integer daysLeft;
    /** Дедлайн уже не выполняется текущим темпом. */
    boolean behindSchedule;
}
