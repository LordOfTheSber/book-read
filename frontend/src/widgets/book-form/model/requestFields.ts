import type { Dayjs } from 'dayjs';
import { ItemFormat, MediaKind, ProgressUnit, ReadingStatus } from '@/shared/types/library';

/**
 * Поля, из которых собирается запрос карточки, — ровно те, что принимает сервер.
 *
 * Список нужен именно явный. Ant Design возвращает из `validateFields()` только те поля, которые
 * сейчас нарисованы на экране: свёрнутый блок «Издание» и неоткрытая вкладка «Оценка и отзыв»
 * в форме не смонтированы, их значения лежат в хранилище формы, но в результат проверки не
 * попадают. Сервер же принимает карточку целиком и всё, чего в запросе нет, обнуляет — поэтому
 * собранная по каталогу карточка теряла ISBN, год, язык и объём, а сохранение с «Карточки»
 * стирало отзыв и оценки.
 *
 * Второе назначение списка — отсечь лишнее. В режиме редактирования в хранилище формы попадает
 * вся запись целиком (`id`, `authors`, `progress`, `createdAt`…), и слать это на сервер незачем.
 */
export const bookRequestFields = [
  'kind',
  'title',
  'altTitle',
  'typeId',
  'sourceId',
  'authorNames',
  'tagNames',
  'shelfIds',
  'seriesName',
  'orderInSeries',
  'isbn',
  'publishedYear',
  'language',
  'pageCount',
  'translator',
  'format',
  'bookcase',
  'shelf',
  'startedAt',
  'finishedAt',
  'deadline',
  'progressTotal',
  'progressUnit',
  'note',
  'review',
  'reviewSpoiler',
  'rating',
  'ratingPlot',
  'ratingStyle',
  'ratingCharacters',
  'ratingEnding',
  'favorite',
  'wishlist',
  'price',
  'currency',
  'purchaseUrl',
  'status'
] as const;

export type BookRequestField = (typeof bookRequestFields)[number];

/** Те же поля, но так, как они лежат в форме: даты — объекты dayjs, а не строки. */
export type BookFormValues = Omit<BookRequest, 'startedAt' | 'finishedAt' | 'deadline'> & {
  startedAt?: Dayjs | null;
  finishedAt?: Dayjs | null;
  deadline?: Dayjs | null;
};

/**
 * Тело запроса карточки. Даты здесь уже строками: в форме они живут объектами dayjs.
 *
 * Прогресса в списке нет намеренно: текущую позицию ведут заходы и смена статуса, и карточка,
 * открытая до отметки «+20 страниц», откатила бы её назад значением, прочитанным при открытии.
 */
export interface BookRequest {
  kind?: MediaKind;
  title?: string;
  altTitle?: string;
  typeId?: string;
  sourceId?: string;
  authorNames?: string[];
  tagNames?: string[];
  shelfIds?: string[];
  seriesName?: string;
  orderInSeries?: number;
  isbn?: string;
  publishedYear?: number;
  language?: string;
  pageCount?: number;
  translator?: string;
  format?: ItemFormat;
  bookcase?: string;
  shelf?: string;
  startedAt?: string;
  finishedAt?: string;
  deadline?: string;
  progressTotal?: number;
  progressUnit?: ProgressUnit;
  note?: string;
  review?: string;
  reviewSpoiler?: string;
  rating?: number;
  ratingPlot?: number;
  ratingStyle?: number;
  ratingCharacters?: number;
  ratingEnding?: number;
  favorite?: boolean;
  wishlist?: boolean;
  price?: number;
  currency?: string;
  purchaseUrl?: string;
  status?: ReadingStatus;
}
