/** Формы слова для 1, 2 и 5 — их держат рядом с сущностью, а не по месту вызова. */
export type PluralForms = [string, string, string];

/**
 * Русская форма слова по числу: plural(2, ['тип', 'типа', 'типов']) → 'типа'.
 * Формы задаются для 1, 2 и 5.
 */
export const plural = (count: number, forms: PluralForms) => {
  const abs = Math.abs(count) % 100;
  const tail = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];

  return forms[2];
};

export const pluralize = (count: number, forms: PluralForms) => `${count} ${plural(count, forms)}`;
