import { ItemFormat, LibraryItem, ProgressUnit } from '@/shared/types/library';
import { mediaKindMeta } from '@/shared/constants/mediaKind';

/** Короткая подпись к шкале прогресса. */
export const progressUnitLabel: Record<ProgressUnit, string> = {
  PAGES: 'стр.',
  MINUTES: 'мин.',
  EPISODES: 'эп.',
  VOLUMES: 'т.'
};

/** Полная подпись — для подписей полей и выпадающих списков. */
export const progressUnitName: Record<ProgressUnit, string> = {
  PAGES: 'Страницы',
  MINUTES: 'Минуты',
  EPISODES: 'Эпизоды',
  VOLUMES: 'Тома'
};

/** Родительный падеж для счётных подписей: «объём — 400 страниц». */
export const progressUnitGenitive: Record<ProgressUnit, string> = {
  PAGES: 'страниц',
  MINUTES: 'минут',
  EPISODES: 'эпизодов',
  VOLUMES: 'томов'
};

/** Подпись позиции внутри шкалы: «с какой страницы», «с какого эпизода». */
export const progressPositionLabel: Record<ProgressUnit, string> = {
  PAGES: 'страницы',
  MINUTES: 'минуты',
  EPISODES: 'эпизода',
  VOLUMES: 'тома'
};

/**
 * Шаги быстрого продвижения. Они обязаны зависеть от единицы: «+50» осмысленно для страниц
 * и минут, но «+50 эпизодов» или «+50 томов» — бессмыслица.
 */
export const progressQuickSteps: Record<ProgressUnit, number[]> = {
  PAGES: [10, 25, 50],
  MINUTES: [15, 30, 60],
  EPISODES: [1, 2, 5],
  VOLUMES: [1, 2, 5]
};

export const progressUnitOptions = (Object.keys(progressUnitLabel) as ProgressUnit[]).map((value) => ({
  label: progressUnitName[value],
  value
}));

/** Формат экземпляра задаёт единицу прогресса: страницы у текста, минуты у аудио. */
export const formatMeta: Record<ItemFormat, { label: string; unit: string }> = {
  PAPER: { label: 'Бумажная', unit: 'страниц' },
  EBOOK: { label: 'Электронная', unit: 'страниц' },
  AUDIO: { label: 'Аудио', unit: 'минут' }
};

export const formatOptions = (Object.keys(formatMeta) as ItemFormat[]).map((value) => ({
  label: formatMeta[value].label,
  value
}));

/**
 * Та же цепочка, что и в `ReadingProgressService`: своя единица из карточки, иначе аудиоформат,
 * иначе вид произведения. Интерфейсу она нужна, чтобы подписать поля до ответа сервера —
 * пользователь выбирает вид и сразу видит, в чём будет считаться прогресс.
 */
export const resolveProgressUnit = (
  source: Pick<Partial<LibraryItem>, 'progress' | 'format' | 'kind'> & { progressUnit?: ProgressUnit }
): ProgressUnit => {
  const explicit = source.progress?.unit ?? source.progressUnit;
  if (explicit) return explicit;
  if (source.format === 'AUDIO') return 'MINUTES';
  return source.kind ? mediaKindMeta[source.kind]?.defaultUnit ?? 'PAGES' : 'PAGES';
};
