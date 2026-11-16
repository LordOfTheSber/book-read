import { LibraryItem } from '@/shared/types/library';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';
import { formatScore } from './format';

export interface CriterionValue {
  key: (typeof ratingCriteria)[number]['key'];
  label: string;
  value?: number;
}

/** Оценки по критериям в порядке макета, вместе с незаполненными. */
export const criteriaValues = (source: Partial<LibraryItem>): CriterionValue[] =>
  ratingCriteria.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    value: source[criterion.key] ?? undefined
  }));

/**
 * Подпись рядом с оценкой критерия. Показывается не всегда: сказать «ниже общей» про каждый
 * второй критерий — значит не сказать ничего. Отмечаем только то, что стоит заметить: чего
 * ещё нет, что вышло лучше всего и что перевесило общую оценку.
 */
export const criterionHint = (value: number | undefined, all: CriterionValue[], overall?: number) => {
  if (value === undefined) return 'нажмите, чтобы поставить';

  const scored = all.map((criterion) => criterion.value).filter((v): v is number => v !== undefined);
  const best = Math.max(...scored);
  // «Лучшее в книге» имеет смысл, только когда есть с чем сравнивать и лидер один.
  if (scored.length > 1 && value === best && scored.filter((v) => v === best).length === 1) {
    return 'лучшее в книге';
  }
  if (overall !== undefined && value > overall) return 'выше общей';
  return '';
};

/**
 * Строка под критериями: среднее по заполненным и его расхождение с общей оценкой.
 *
 * Расхождение — не ошибка, а смысл раздельных шкал: общая оценка ставится отдельно, потому
 * что вес у критериев разный. Показываем оба числа, чтобы это было видно, а не угадывалось.
 */
export const criteriaSummary = (values: CriterionValue[], overall?: number) => {
  const scored = values.map((criterion) => criterion.value).filter((v): v is number => v !== undefined);
  if (scored.length === 0) return undefined;

  const average = scored.reduce((sum, value) => sum + value, 0) / scored.length;
  const rounded = Math.round(average * 10) / 10;
  const head = `Среднее по заполненным критериям — ${formatScore(rounded)}.`;

  if (overall === undefined) {
    return `${head} Общая оценка пока не стоит: из критериев она не складывается.`;
  }
  if (Math.abs(rounded - overall) < 0.05) {
    return `${head} Общая оценка ${formatScore(overall)} — столько же.`;
  }
  const side = overall < rounded ? 'ниже' : 'выше';
  return `${head} Общая оценка ${formatScore(overall)} стоит ${side} — она ставится отдельно, а не выводится из критериев.`;
};

/** Сколько шкал заполнено: «заполнено 3 из 4». */
export const criteriaFilled = (values: CriterionValue[]) =>
  values.filter((criterion) => criterion.value !== undefined).length;
