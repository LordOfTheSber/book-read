import { useEffect, useState } from 'react';
import type { ReadingGoal } from '@/shared/types/library';
import { fetchGoal } from '../api/engagementApi';

/**
 * Доля годовой цели, 0…1. Считается по книгам, а если цель задана в страницах или минутах —
 * по ним: у знака в шапке одна лента, и мерить её надо тем, что человек себе назначил.
 */
export const goalProgress = (goal?: ReadingGoal): number | undefined => {
  if (!goal?.configured) return undefined;

  const metric = goal.items ?? goal.pages ?? goal.minutes;
  if (!metric || metric.target <= 0) return undefined;

  return Math.min(1, Math.max(0, metric.done / metric.target));
};

/**
 * Цель года на всё приложение. Запрос один на сессию: знак в шапке живёт на каждой странице,
 * и перезапрашивать цель при каждом переходе — та же цифра за те же деньги.
 */
let pending: Promise<ReadingGoal> | null = null;

export const loadYearGoal = (): Promise<ReadingGoal> => {
  pending ??= fetchGoal();
  return pending;
};

/** Сохранение цели делает кеш неверным: следующий знак должен нарисоваться по новой цели. */
export const resetYearGoal = (): void => {
  pending = null;
};

export const useYearGoalProgress = (enabled: boolean): number | undefined => {
  const [progress, setProgress] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      // Выход из учётной записи обнуляет и кеш: иначе следующий вошедший в той же вкладке
      // увидел бы на знаке чужую цель.
      resetYearGoal();
      setProgress(undefined);
      return;
    }

    let cancelled = false;
    loadYearGoal()
      .then((goal) => {
        if (!cancelled) setProgress(goalProgress(goal));
      })
      .catch(() => {
        // Цель — украшение знака, а не содержание страницы: молча оставляем полную закладку.
        resetYearGoal();
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return progress;
};
