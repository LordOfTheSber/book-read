import { ExternalBook } from '@/shared/types/library';

/**
 * Строка из одних цифр и дефисов — это ISBN, а не название: искать его надо по своему полю.
 * Живёт здесь, а не в двух окнах поиска сразу: по каталогам ищут и добавление, и панель правки.
 */
export const looksLikeIsbn = (value: string) => /^[\d\s-]{10,17}[\dXx]?$/.test(value.trim());

/** Запрос к каталогам: ISBN уходит своим полем и без разделителей. */
export const metadataQuery = (value: string) => {
  const trimmed = value.trim();
  return looksLikeIsbn(trimmed) ? { isbn: trimmed.replace(/[\s-]/g, '') } : { q: trimmed };
};

/** Строка мелочей находки: год, объём, язык, издательство — то, чем издания отличаются друг от друга. */
export const describeExternal = (book: ExternalBook) =>
  [
    book.publishedYear,
    book.pageCount ? `${book.pageCount} стр.` : undefined,
    book.language,
    book.publisher
  ]
    .filter(Boolean)
    .join(' · ');
