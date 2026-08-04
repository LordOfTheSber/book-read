import { ItemFormat } from '@/shared/types/library';

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
