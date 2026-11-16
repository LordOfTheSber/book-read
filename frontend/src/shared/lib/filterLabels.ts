import { getMediaKindLabel } from '@/shared/constants/mediaKind';
import { statusMeta } from '@/shared/constants/status';
import type { MediaKind, ReadingStatus } from '@/shared/types/library';

/** Одно условие фильтра словами: ключ нужен, чтобы это же условие можно было снять. */
export interface FilterChip {
  key: string;
  label: string;
}

/**
 * Справочники для подписей. Здесь только имя и идентификатор: подписи не должны зависеть
 * от того, какими полями обрастут авторы и полки.
 */
export interface FilterNames {
  bookTypes?: Array<{ id: string; name: string }>;
  authors?: Array<{ id: string; name: string }>;
  series?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string }>;
  shelves?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; username: string }>;
}

/** Поля выдачи, которые вообще описываются словами; страница фильтров знает о них больше. */
export interface DescribableFilters {
  status?: string;
  typeId?: string;
  kind?: string;
  authorId?: string;
  seriesId?: string;
  tagId?: string;
  shelfId?: string;
  favorite?: boolean;
  wishlist?: boolean;
  minRating?: number | null;
  maxRating?: number | null;
  userId?: string;
}

const nameOf = (list: Array<{ id: string; name: string }> | undefined, id: string, fallback: string) =>
  list?.find((entry) => entry.id === id)?.name ?? fallback;

/**
 * Фильтры выдачи словами: «Статус: Читаю», «Оценка от 9».
 *
 * Один и тот же список нужен трём местам — строке «Показаны:», пустому экрану («какое условие
 * всё срезало») и окну умной полки («что именно сохранится»), — и расходиться они не должны:
 * человек сохраняет ровно то, что видит.
 */
export const describeFilters = (filters: DescribableFilters, names: FilterNames = {}): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filters.status) {
    chips.push({
      key: 'status',
      label: `Статус: ${statusMeta[filters.status as ReadingStatus]?.label ?? filters.status}`
    });
  }
  if (filters.typeId) {
    chips.push({ key: 'typeId', label: `Тип: ${nameOf(names.bookTypes, filters.typeId, 'выбран')}` });
  }
  if (filters.kind) {
    chips.push({ key: 'kind', label: `Вид: ${getMediaKindLabel(filters.kind as MediaKind)}` });
  }
  if (filters.authorId) {
    chips.push({ key: 'authorId', label: `Автор: ${nameOf(names.authors, filters.authorId, 'выбран')}` });
  }
  if (filters.seriesId) {
    chips.push({ key: 'seriesId', label: `Серия: ${nameOf(names.series, filters.seriesId, 'выбрана')}` });
  }
  if (filters.tagId) {
    chips.push({ key: 'tagId', label: `Тег: ${nameOf(names.tags, filters.tagId, 'выбран')}` });
  }
  if (filters.shelfId) {
    chips.push({ key: 'shelfId', label: `Полка: ${nameOf(names.shelves, filters.shelfId, 'выбрана')}` });
  }
  if (filters.favorite) {
    chips.push({ key: 'favorite', label: 'Только избранное' });
  }
  if (filters.wishlist) {
    chips.push({ key: 'wishlist', label: 'Список желаемого' });
  }
  if (filters.minRating !== undefined && filters.minRating !== null) {
    chips.push({ key: 'minRating', label: `Оценка от ${filters.minRating}` });
  }
  if (filters.maxRating !== undefined && filters.maxRating !== null) {
    chips.push({ key: 'maxRating', label: `Оценка до ${filters.maxRating}` });
  }
  if (filters.userId) {
    const username = names.users?.find((user) => user.id === filters.userId)?.username ?? 'выбран';
    chips.push({ key: 'userId', label: `Пользователь: ${username}` });
  }

  return chips;
};
