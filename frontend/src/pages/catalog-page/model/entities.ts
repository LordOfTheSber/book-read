import type { PluralForms } from '@/shared/lib/plural';

/** Четыре справочника, собранные в одну страницу: адрес запоминает выбранный. */
export type CatalogEntityKey = 'authors' | 'series' | 'types' | 'sources';

export interface CatalogField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** Ссылка проверяется на адрес, а не просто на непустоту. */
  url?: boolean;
  multiline?: boolean;
}

export interface CatalogEntityMeta {
  key: CatalogEntityKey;
  label: string;
  /** Склонение для подписи «214 авторов в справочнике». */
  words: PluralForms;
  searchPlaceholder: string;
  addButton: string;
  createTitle: string;
  editTitle: string;
  emptyTitle: string;
  emptyHint: string;
  /**
   * Карточки — там, где у записи есть книги: обложки отвечают на вопрос «что у меня есть».
   * Типам и источникам показывать нечего, им остаётся строка с правкой на месте.
   */
  view: 'cards' | 'rows';
  /**
   * Поля записи — общие для окна создания и для правки в строке: два описания полей разошлись бы
   * при первом же новом поле.
   */
  fields: CatalogField[];
}

export const CATALOG_ENTITIES: CatalogEntityMeta[] = [
  {
    key: 'authors',
    label: 'Авторы',
    words: ['автор', 'автора', 'авторов'],
    searchPlaceholder: 'Найти автора',
    addButton: 'Добавить автора',
    createTitle: 'Новый автор',
    editTitle: 'Редактирование автора',
    emptyTitle: 'Авторов пока нет',
    emptyHint: 'Автор заводится сам, когда вы вписываете имя в карточку книги.',
    view: 'cards',
    fields: [
      { key: 'name', label: 'Имя', placeholder: 'Например, «Лю Цысинь»', required: true },
      { key: 'altName', label: 'Имя в оригинале', placeholder: 'Liu Cixin' }
    ]
  },
  {
    key: 'series',
    label: 'Серии',
    words: ['серия', 'серии', 'серий'],
    searchPlaceholder: 'Найти серию',
    addButton: 'Добавить серию',
    createTitle: 'Новая серия',
    editTitle: 'Редактирование серии',
    emptyTitle: 'Серий пока нет',
    emptyHint: 'Серия заводится сама, когда вы вписываете её название в карточку книги.',
    view: 'cards',
    fields: [
      { key: 'name', label: 'Название', placeholder: 'Например, «Воспоминания о прошлом Земли»', required: true },
      { key: 'description', label: 'Описание', placeholder: 'О чём цикл', multiline: true }
    ]
  },
  {
    key: 'types',
    label: 'Типы',
    words: ['тип', 'типа', 'типов'],
    searchPlaceholder: 'Найти тип',
    addButton: 'Добавить тип',
    createTitle: 'Новый тип',
    editTitle: 'Редактирование типа',
    emptyTitle: 'Типов пока нет',
    emptyHint: 'Типы группируют книги: роман, манга, нон-фикшн.',
    view: 'rows',
    fields: [{ key: 'name', label: 'Название', placeholder: 'Например, «Нон-фикшн»', required: true }]
  },
  {
    key: 'sources',
    label: 'Источники',
    words: ['источник', 'источника', 'источников'],
    searchPlaceholder: 'Найти источник',
    addButton: 'Добавить источник',
    createTitle: 'Новый источник',
    editTitle: 'Редактирование источника',
    emptyTitle: 'Источников пока нет',
    emptyHint: 'Источник — это откуда вы читаете: магазин, библиотека, полка дома.',
    view: 'rows',
    fields: [
      { key: 'name', label: 'Название', placeholder: 'Например, «Литрес»', required: true },
      { key: 'url', label: 'Ссылка', placeholder: 'https://example.com', required: true, url: true },
      { key: 'description', label: 'Описание', placeholder: 'Дополнительные детали', multiline: true }
    ]
  }
];

export const catalogMeta = (key: CatalogEntityKey): CatalogEntityMeta =>
  CATALOG_ENTITIES.find((entity) => entity.key === key) ?? CATALOG_ENTITIES[0];

/** Адрес — источник правды: со старых `/authors` и `/types` сюда ведёт редирект. */
export const isCatalogEntity = (value: string | null): value is CatalogEntityKey =>
  CATALOG_ENTITIES.some((entity) => entity.key === value);

export type CatalogSort = 'frequent' | 'finished' | 'alphabet' | 'recent';

export interface CatalogSortOption {
  value: CatalogSort;
  label: string;
}

/**
 * Порядок сортировок разный у карточек и строк: у автора спрашивают «кого я читаю больше»,
 * у типа — «как это называется». Первый пункт в списке и есть выбор по умолчанию.
 */
export const catalogSortOptions = (view: CatalogEntityMeta['view']): CatalogSortOption[] =>
  view === 'cards'
    ? [
        { value: 'frequent', label: 'Сначала частые' },
        { value: 'finished', label: 'Сначала прочитанные' },
        { value: 'alphabet', label: 'По алфавиту' }
      ]
    : [
        { value: 'alphabet', label: 'По алфавиту' },
        { value: 'recent', label: 'Недавно менялись' }
      ];
