import type { ReadingStatus } from '@/shared/types/library';

export const statusOptions = [
  { label: 'Читаю', value: 'READING' },
  { label: 'Отложено', value: 'ON_HOLD' },
  { label: 'Заброшено', value: 'DROPPED' },
  { label: 'Завершено', value: 'COMPLETED' },
  { label: 'В планах', value: 'PLANNED' }
] as const;

interface StatusMeta {
  label: string;
  /** Пресет Ant Design: сам подстраивается под светлую/тёмную тему. */
  color: string;
  /** Токен темы для акцентов вне Tag (плитки, полоски). */
  token: 'colorInfo' | 'colorSuccess' | 'colorError' | 'colorTextTertiary' | 'purple6';
}

export const statusMeta: Record<ReadingStatus, StatusMeta> = {
  READING: { label: 'Читаю', color: 'processing', token: 'colorInfo' },
  // Отложено и заброшено — разные состояния: к первому собираются вернуться.
  ON_HOLD: { label: 'Отложено', color: 'default', token: 'colorTextTertiary' },
  COMPLETED: { label: 'Завершено', color: 'success', token: 'colorSuccess' },
  // Оранжевый «warning» читался как предупреждение, хотя план — нейтральное намерение;
  // заодно золотой остался за избранным, и плитки «В планах» и «Избранное» перестали совпадать.
  PLANNED: { label: 'В планах', color: 'purple', token: 'purple6' },
  DROPPED: { label: 'Заброшено', color: 'error', token: 'colorError' }
};

export const getStatusLabel = (status?: string) =>
  (status && statusMeta[status as ReadingStatus]?.label) || status || '—';

export const getStatusColor = (status?: string) =>
  (status && statusMeta[status as ReadingStatus]?.color) || 'default';

export const sortOptions = [
  { label: 'Сначала новые', value: 'updatedAt,desc' },
  { label: 'Сначала старые', value: 'updatedAt,asc' },
  { label: 'Название А→Я', value: 'title,asc' },
  { label: 'Название Я→А', value: 'title,desc' },
  { label: 'Оценка: высокая', value: 'rating,desc' },
  { label: 'Оценка: низкая', value: 'rating,asc' }
] as const;
