import { useEffect, useRef, useState } from 'react';
import { fetchBooks } from '@/entities/book';
import type { LibraryItem } from '@/shared/types/library';
import type { CatalogEntityKey } from './entities';

/** Больше четырёх обложек в карточку не помещается, остальное уходит в «+N». */
export const COVERS_IN_CARD = 4;

/**
 * Обложки для карточек справочника: по запросу на видимую карточку, а не на каждого автора
 * из двухсот. Карточки показываются порциями, поэтому запросов столько же, сколько карточек
 * на экране; уже спрошенное второй раз не запрашивается даже при пересортировке.
 *
 * Ошибка запроса гасится молча: обложки — украшение карточки, а не её содержание, и ронять
 * из-за них справочник нельзя.
 */
export const useCatalogCovers = (entity: CatalogEntityKey, ids: string[]) => {
  const [covers, setCovers] = useState<Record<string, LibraryItem[]>>({});
  const requested = useRef<Set<string>>(new Set());
  const key = ids.join(',');

  useEffect(() => {
    requested.current = new Set();
    setCovers({});
  }, [entity]);

  useEffect(() => {
    if (entity !== 'authors' && entity !== 'series') return undefined;

    const pending = ids.filter((id) => !requested.current.has(id));
    if (pending.length === 0) return undefined;
    pending.forEach((id) => requested.current.add(id));

    let cancelled = false;
    void Promise.all(
      pending.map(async (id) => {
        try {
          const page = await fetchBooks(
            entity === 'authors'
              ? { authorId: id, size: COVERS_IN_CARD, sort: 'updatedAt,desc' }
              : // Цикл читают по порядку — и стопка обложек должна лежать в том же порядке.
                { seriesId: id, size: COVERS_IN_CARD, sort: 'orderInSeries,asc' }
          );
          return [id, page.content] as const;
        } catch {
          return [id, [] as LibraryItem[]] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setCovers((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });

    return () => {
      cancelled = true;
    };
    // ids сравниваются по составу: новая ссылка на тот же список не должна звать сервер заново.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, key]);

  return covers;
};
