import { ItemFormat, ProgressUnit } from '@/shared/types/library';

/** Подпись к шкале прогресса. */
export const progressUnitLabel: Record<ProgressUnit, string> = {
  PAGES: 'стр.',
  MINUTES: 'мин.',
  EPISODES: 'эп.',
  VOLUMES: 'т.'
};

export const progressUnitOptions = (Object.keys(progressUnitLabel) as ProgressUnit[]).map((value) => ({
  label: { PAGES: 'Страницы', MINUTES: 'Минуты', EPISODES: 'Эпизоды', VOLUMES: 'Тома' }[value],
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
