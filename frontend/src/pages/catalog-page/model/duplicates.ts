import type { Author } from '@/shared/types/library';

export interface DuplicatePair {
  /** Тот, кого предлагается оставить: у него больше книг. */
  keep: Author;
  /** Тот, чьи книги переедут; сам он после слияния исчезнет. */
  merge: Author;
}

/**
 * Приводит имя к виду, в котором «Лю Цысинь», «лю  цысинь» и «Лю-Цысинь» — одно и то же:
 * регистр, ё, дефисы, точки и лишние пробелы значения не имеют.
 */
const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.\-_'’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Порядок слов в имени не постоянен: «Cixin Liu» и «Liu Cixin» — один человек. */
const sortedWords = (name: string) => normalize(name).split(' ').sort().join(' ');

/** Ключи, по которым автора можно узнать: своё имя, имя из перестановки и второе имя. */
const keysOf = (author: Author) => {
  const keys = new Set<string>([normalize(author.name), sortedWords(author.name)]);
  if (author.altName) {
    keys.add(normalize(author.altName));
    keys.add(sortedWords(author.altName));
  }
  return keys;
};

/**
 * Ищет пары, похожие на дубли одного автора.
 *
 * Справочник пополняется сам, когда имя вписывают в карточку книги, — поэтому дубли заводятся
 * молча и всплывают месяцы спустя. Ищутся два случая: совпадение имён с точностью до регистра и
 * перестановки слов и совпадение имени одного автора со вторым именем другого («Лю Цысинь»
 * с латинским `Cixin Liu` в поле «Имя в оригинале»). Транслитерацию по буквам не разбираем:
 * ложная подсказка про объединение хуже отсутствующей.
 */
export const findDuplicatePairs = (authors: Author[]): DuplicatePair[] => {
  const pairs: DuplicatePair[] = [];
  const paired = new Set<string>();

  for (let i = 0; i < authors.length; i += 1) {
    for (let j = i + 1; j < authors.length; j += 1) {
      const left = authors[i];
      const right = authors[j];
      if (paired.has(left.id) || paired.has(right.id)) continue;

      const leftKeys = keysOf(left);
      const matches = [...keysOf(right)].some((key) => leftKeys.has(key));
      if (!matches) continue;

      // Остаётся тот, у кого книг больше: переезд меньшего числа записей — меньше правок.
      const [keep, merge] = left.itemCount >= right.itemCount ? [left, right] : [right, left];
      pairs.push({ keep, merge });
      paired.add(left.id);
      paired.add(right.id);
    }
  }

  return pairs;
};
