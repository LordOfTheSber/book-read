/**
 * Критерии многокритериальной оценки. Общая оценка остаётся отдельной: усреднять критерии
 * за пользователя неправильно — вес у них у каждого свой.
 */
export const ratingCriteria = [
  { key: 'ratingPlot', label: 'Сюжет' },
  { key: 'ratingStyle', label: 'Язык' },
  { key: 'ratingCharacters', label: 'Персонажи' },
  { key: 'ratingEnding', label: 'Финал' }
] as const;

export type RatingCriterionKey = (typeof ratingCriteria)[number]['key'];
