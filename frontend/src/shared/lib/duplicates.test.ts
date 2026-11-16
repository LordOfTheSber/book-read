import { describe, expect, it } from 'vitest';
import { findDuplicates, NamedEntry } from './duplicates';

const entry = (id: string, name: string, itemCount = 0, altName?: string): NamedEntry => ({
  id,
  name,
  itemCount,
  altName
});

describe('findDuplicates', () => {
  /** Ровно тот случай, ради которого подсказка и появилась: имя вписали руками дважды. */
  it('сводит имена, разошедшиеся регистром и пробелами', () => {
    const pairs = findDuplicates([entry('1', 'Стругацкие', 11), entry('2', ' стругацкие ', 2)]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].reason).toBe('same');
  });

  /** Остаётся тот, за кем больше записей: переподвешивать меньшее — меньше работы. */
  it('оставляет автора с большей библиотекой', () => {
    const [pair] = findDuplicates([entry('1', 'Лю Цысинь', 2), entry('2', 'лю цысинь', 6)]);

    expect(pair.target.id).toBe('2');
    expect(pair.source.id).toBe('1');
  });

  /** Имя в оригинале — второй способ записать того же автора, и справочник держит оба. */
  it('узнаёт автора по имени в оригинале', () => {
    const [pair] = findDuplicates([entry('1', 'Лю Цысинь', 6, 'Cixin Liu'), entry('2', 'Cixin Liu', 2)]);

    expect(pair.reason).toBe('alt');
    expect(pair.target.name).toBe('Лю Цысинь');
  });

  it('ловит опечатку в одну букву у длинного имени', () => {
    const [pair] = findDuplicates([entry('1', 'Фрэнк Герберт', 5), entry('2', 'Фрэнк Гербeрт', 1)]);

    expect(pair?.reason).toBe('typo');
  });

  /** «Дюна» и «Луна» тоже различаются одной буквой, но это разные названия. */
  it('не трогает короткие имена, различающиеся буквой', () => {
    expect(findDuplicates([entry('1', 'Дюна', 3), entry('2', 'Луна', 1)])).toEqual([]);
  });

  /** Похожие по смыслу пометки свести может только человек. */
  it('не считает дублями непохожие названия', () => {
    expect(findDuplicates([entry('1', 'фантастика', 64), entry('2', 'нон-фикшн', 41)])).toEqual([]);
  });

  /** Объединение первой пары ломало бы вторую: запись уже переехала. */
  it('не берёт одну запись в две пары', () => {
    const pairs = findDuplicates([entry('1', 'манга', 28), entry('2', 'Манга', 3), entry('3', 'МАНГА', 1)]);

    expect(pairs).toHaveLength(1);
  });
});
