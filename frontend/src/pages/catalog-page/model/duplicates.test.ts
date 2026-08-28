import { describe, expect, it } from 'vitest';
import { findDuplicatePairs } from './duplicates';
import type { Author } from '@/shared/types/library';

const author = (name: string, itemCount: number, altName?: string): Author => ({
  id: `${name}-${itemCount}`,
  name,
  altName,
  itemCount,
  finishedCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
});

describe('дубли в справочнике авторов', () => {
  it('видит одно имя, записанное по-разному', () => {
    const pairs = findDuplicatePairs([author('Лю Цысинь', 6), author('лю  цысинь', 2)]);

    expect(pairs).toHaveLength(1);
    // Остаётся тот, у кого книг больше: переезжает меньшее число записей.
    expect(pairs[0].keep.itemCount).toBe(6);
    expect(pairs[0].merge.itemCount).toBe(2);
  });

  it('видит перестановку слов', () => {
    const pairs = findDuplicatePairs([author('Cixin Liu', 2), author('Liu Cixin', 6)]);

    expect(pairs[0].keep.name).toBe('Liu Cixin');
  });

  /** Латинское имя попадает в справочник из карточки книги и живёт вторым именем у своего автора. */
  it('связывает имя с чужим вторым именем', () => {
    const pairs = findDuplicatePairs([author('Лю Цысинь', 6, 'Cixin Liu'), author('Cixin Liu', 2)]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].keep.name).toBe('Лю Цысинь');
  });

  it('однофамильцев дублями не считает', () => {
    expect(findDuplicatePairs([author('Аркадий Стругацкий', 5), author('Борис Стругацкий', 4)])).toEqual(
      []
    );
  });

  /** Каждый автор попадает не больше чем в одну пару: три «Лю Цысиня» — это одна подсказка. */
  it('не строит пересекающихся пар', () => {
    const pairs = findDuplicatePairs([author('Лю Цысинь', 6), author('лю цысинь', 2), author('ЛЮ ЦЫСИНЬ', 1)]);

    expect(pairs).toHaveLength(1);
  });
});
