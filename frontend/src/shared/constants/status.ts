import type { ReadingStatus } from '@/shared/types/library';
import { brand } from '@/shared/config/brand';

export const statusOptions = [
  { label: 'Читаю', value: 'READING' },
  { label: 'Отложено', value: 'ON_HOLD' },
  { label: 'Заброшено', value: 'DROPPED' },
  { label: 'Завершено', value: 'COMPLETED' },
  { label: 'В планах', value: 'PLANNED' }
] as const;

interface StatusMeta {
  label: string;
  /** Цвет статуса в фирменной палитре: он же текст чипа, он же акцент плитки и полоски. */
  accent: string;
}

export const statusMeta: Record<ReadingStatus, StatusMeta> = {
  READING: { label: 'Читаю', accent: brand.ink },
  // Отложено и заброшено — разные состояния: к первому собираются вернуться.
  ON_HOLD: { label: 'Отложено', accent: brand.amber },
  COMPLETED: { label: 'Завершено', accent: brand.moss },
  // Оранжевый «warning» читался как предупреждение, хотя план — нейтральное намерение;
  // заодно закладка осталась за прогрессом, и «В планах» перестало спорить с ней за внимание.
  PLANNED: { label: 'В планах', accent: brand.plum },
  DROPPED: { label: 'Заброшено', accent: brand.wax }
};

export const getStatusLabel = (status?: string) =>
  (status && statusMeta[status as ReadingStatus]?.label) || status || '—';

export const getStatusAccent = (status?: string) =>
  (status && statusMeta[status as ReadingStatus]?.accent) || brand.ink;

export const sortOptions = [
  { label: 'Сначала новые', value: 'updatedAt,desc' },
  { label: 'Сначала старые', value: 'updatedAt,asc' },
  { label: 'Название А→Я', value: 'title,asc' },
  { label: 'Название Я→А', value: 'title,desc' },
  { label: 'Оценка: высокая', value: 'rating,desc' },
  { label: 'Оценка: низкая', value: 'rating,asc' }
] as const;
