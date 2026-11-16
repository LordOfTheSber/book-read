import type { MediaKind } from '@/shared/types/library';

/**
 * Материал бренда: чернила и бумага вместо синего Ant Design и холодного серого.
 *
 * Один тёплый акцент — закладка: она же полоса прогресса, она же активное состояние, она же
 * ленточка на обложке. Ошибки уходят в сургучный, чтобы не спорить с акцентом, успех — в мох.
 * Значения выверены по контрасту в макетах: у текста порог 4,5:1, поэтому акцент-текст
 * темнее акцент-заливки.
 */
export const brand = {
  /** Основной: шапка, кнопки, заголовки. */
  ink: '#1B2A4A',
  inkText: '#17202E',
  inkDeep: '#122038',
  /** Единственный акцент: прогресс, активное, ссылки. */
  bookmark: '#C8552F',
  bookmarkText: '#B04B29',
  bookmarkHover: '#A8421F',
  bookmarkBg: '#F7EAE4',
  /** Фон приложения вместо холодного серого. */
  paper: '#FBF8F3',
  paperSoft: '#F3EEE6',
  surface: '#FFFFFF',
  /** Границы и разделители. */
  binding: '#E7E0D4',
  bindingSoft: '#F0EAE0',
  /** Завершено, успех. */
  moss: '#3C7A5A',
  mossBg: '#EAF0EA',
  /** Внимание — приглушённое золото, а не жёлтый. */
  amber: '#B8862B',
  amberBg: '#FBF1DF',
  /** Удаление и ошибки — отдельно от закладки. */
  wax: '#9E2B2B',
  waxBg: '#F9EDEA',
  /** Намерение прочитать: нейтральный лиловый, не спорящий ни с закладкой, ни с мохом. */
  plum: '#6B4EA6',
  plumBg: '#F0EBF5',
  /** Ночь: та же бумага, вывернутая в чернила. */
  night: {
    layout: '#101728',
    surface: '#141C2E',
    elevated: '#1E2940',
    border: '#2A3350',
    text: '#E9E3D8'
  }
} as const;

/** Literata сделана для чтения книг с экрана — заголовки и названия произведений набираются ей. */
export const displayFont = "'Literata', Georgia, 'Times New Roman', serif";

/** Интерфейс, поля и цифры остаются на Inter: переверстка не нужна. */
export const uiFont =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Девять цветов видов произведения одной насыщенности вместо ярких пресетов Ant Design.
 *
 * `color` — корешок и текст чипа, `paper` — тон бумажной заглушки обложки. Остальные оттенки
 * (заливка чипа, граница, тёмная тема) считаются из `color`, чтобы значение было одно.
 */
export const kindColor: Record<MediaKind, { color: string; paper: string }> = {
  BOOK: { color: '#1B2A4A', paper: '#F2F0EC' },
  AUDIOBOOK: { color: '#2E7D74', paper: '#EDF3F2' },
  MANGA: { color: '#A6446B', paper: '#F5EDF1' },
  COMIC: { color: '#6B4EA6', paper: '#F1EEF6' },
  MOVIE: { color: '#B4552A', paper: '#F7EFE9' },
  SERIES: { color: '#B8862B', paper: '#F7F2E6' },
  ANIME: { color: '#8A6D1F', paper: '#F4F1E4' },
  PODCAST: { color: '#3C5BA6', paper: '#EDF0F7' },
  GAME: { color: '#3C7A5A', paper: '#EEF3F0' }
};
