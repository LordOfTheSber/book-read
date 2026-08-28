import { plural, pluralize } from '@/shared/lib/plural';
import type { Author, BookType, Series, Source } from '@/shared/types/library';
import type { BookFilterState } from '@/features/book/set-book-filters';
import type { CatalogEntityKey, CatalogSort } from './entities';

/**
 * Одна строка справочника независимо от сущности: карточке и таблице нужны одни и те же
 * поля, а различия сущностей остаются в подписях и наборе полей формы.
 */
export interface CatalogRow {
  id: string;
  name: string;
  /** Под названием: второе имя автора, описание серии, ссылка источника. */
  secondary?: string;
  itemCount: number;
  finishedCount: number;
  averageRating?: number;
  updatedAt?: string;
  /** Значения формы для правки — ключи совпадают с `fields` сущности. */
  values: Record<string, string | undefined>;
  /** Фильтр библиотеки для «Все книги»; без него у записи нет своего среза. */
  libraryFilter?: Partial<BookFilterState>;
  /** Строка под стопкой обложек: чем ближе к концу, тем короче остаток. */
  progressPhrase: string;
}

const authorPhrase = (author: Author) => {
  if (author.itemCount === 0) return 'Книг этого автора в библиотеке нет';
  const left = author.itemCount - author.finishedCount;
  if (left <= 0) return 'Прочитано всё, что есть';
  return `Осталось ${left} ${plural(left, ['книга', 'книги', 'книг'])}`;
};

const seriesPhrase = (series: Series) => {
  if (series.itemCount === 0) return 'Частей цикла в библиотеке нет';
  if (series.completedCount >= series.itemCount) return 'Цикл пройден целиком';
  return `Пройдено ${series.completedCount} из ${series.itemCount}`;
};

export const authorRow = (author: Author): CatalogRow => ({
  id: author.id,
  name: author.name,
  secondary: author.altName,
  itemCount: author.itemCount,
  finishedCount: author.finishedCount,
  averageRating: author.averageRating,
  updatedAt: author.updatedAt,
  values: { name: author.name, altName: author.altName },
  libraryFilter: { authorId: author.id },
  progressPhrase: authorPhrase(author)
});

export const seriesRow = (series: Series): CatalogRow => ({
  id: series.id,
  name: series.name,
  secondary: series.description,
  itemCount: series.itemCount,
  finishedCount: series.completedCount,
  averageRating: series.averageRating,
  updatedAt: series.updatedAt,
  values: { name: series.name, description: series.description },
  libraryFilter: { seriesId: series.id },
  progressPhrase: seriesPhrase(series)
});

export const typeRow = (type: BookType, itemCount: number): CatalogRow => ({
  id: type.id,
  name: type.name,
  itemCount,
  finishedCount: 0,
  updatedAt: type.updatedAt,
  values: { name: type.name },
  libraryFilter: { typeId: type.id },
  progressPhrase: ''
});

/**
 * У источника своего среза библиотеки нет: фильтра по источнику в списке не существует,
 * и ссылка «Все книги» вела бы в неотфильтрованную библиотеку.
 */
export const sourceRow = (source: Source, itemCount: number): CatalogRow => ({
  id: source.id,
  name: source.name,
  secondary: source.url,
  itemCount,
  finishedCount: 0,
  updatedAt: source.updatedAt,
  values: { name: source.name, url: source.url, description: source.description },
  progressPhrase: ''
});

/** Подпись карточки: сколько есть и сколько из этого пройдено. */
export const catalogMetaLine = (entity: CatalogEntityKey, row: CatalogRow) => {
  if (row.itemCount === 0) return 'пока ничего нет';
  const total =
    entity === 'series'
      ? pluralize(row.itemCount, ['часть', 'части', 'частей'])
      : pluralize(row.itemCount, ['книга', 'книги', 'книг']);
  if (row.finishedCount === 0) return `${total} · ничего не дочитано`;
  if (row.finishedCount >= row.itemCount) return `${total} · всё дочитано`;
  return `${total} · ${row.finishedCount} дочитано`;
};

export const searchMatches = (row: CatalogRow, query: string) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    row.name.toLowerCase().includes(trimmed) || Boolean(row.secondary?.toLowerCase().includes(trimmed))
  );
};

export const sortRows = (rows: CatalogRow[], sort: CatalogSort): CatalogRow[] => {
  const byName = (a: CatalogRow, b: CatalogRow) => a.name.localeCompare(b.name, 'ru');
  const copy = [...rows];

  switch (sort) {
    case 'frequent':
      return copy.sort((a, b) => b.itemCount - a.itemCount || byName(a, b));
    case 'finished':
      return copy.sort((a, b) => b.finishedCount - a.finishedCount || byName(a, b));
    case 'recent':
      return copy.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || byName(a, b));
    default:
      return copy.sort(byName);
  }
};
