import { describe, expect, it } from 'vitest';
import { criteriaFilled, criteriaSummary, criteriaValues, criterionHint } from '@/shared/lib/rating';
import type { LibraryItem } from '@/shared/types/library';

const item = (extra: Partial<LibraryItem>) => extra as Partial<LibraryItem>;

describe('оценки по критериям', () => {
  it('возвращает все четыре шкалы, включая незаполненные', () => {
    const values = criteriaValues(item({ ratingPlot: 9 }));

    expect(values.map((c) => c.label)).toEqual(['Сюжет', 'Язык', 'Персонажи', 'Финал']);
    expect(values[0].value).toBe(9);
    expect(values[3].value).toBeUndefined();
    expect(criteriaFilled(values)).toBe(1);
  });

  it('среднее считается только по заполненным', () => {
    const values = criteriaValues(item({ ratingPlot: 9, ratingStyle: 9.5, ratingCharacters: 8 }));

    expect(criteriaSummary(values, 8.5)).toContain('8,8');
  });

  /** Расхождение — не ошибка, а смысл раздельных шкал: общая оценка ставится отдельно. */
  it('называет, в какую сторону общая оценка расходится со средним', () => {
    const values = criteriaValues(item({ ratingPlot: 9, ratingStyle: 9 }));

    expect(criteriaSummary(values, 8.5)).toContain('стоит ниже');
    expect(criteriaSummary(values, 9.5)).toContain('стоит выше');
    expect(criteriaSummary(values, 9)).toContain('столько же');
  });

  it('без единой оценки сведения нет', () => {
    expect(criteriaSummary(criteriaValues(item({})), 8)).toBeUndefined();
  });

  it('подсказка отмечает пустую шкалу, лучшую и ту, что выше общей', () => {
    const values = criteriaValues(item({ ratingPlot: 9, ratingStyle: 9.5, ratingCharacters: 8 }));

    expect(criterionHint(undefined, values, 8.5)).toBe('нажмите, чтобы поставить');
    expect(criterionHint(9.5, values, 8.5)).toBe('лучшее в книге');
    expect(criterionHint(9, values, 8.5)).toBe('выше общей');
    // Про то, что ниже общей, молчим: сказать это про половину шкал — значит не сказать ничего.
    expect(criterionHint(8, values, 8.5)).toBe('');
  });

  it('единственная оценка не объявляется лучшей в книге', () => {
    const values = criteriaValues(item({ ratingPlot: 9 }));

    expect(criterionHint(9, values, 8.5)).toBe('выше общей');
  });
});
