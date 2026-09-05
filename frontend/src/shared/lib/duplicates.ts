/**
 * Поиск дублей в справочнике.
 *
 * Автор и тег заводятся сами, когда имя вписывают руками в карточку: «Лю Цысинь» и «лю цысинь»
 * сойдутся в одного, а «Стругацкие» и «Стругацкие  » — уже нет. Через полгода справочник
 * держит две строки об одном, и заметить это можно только глазами, листая двести имён.
 *
 * Ищутся не любые похожие имена, а те, что разошлись способом ввода: регистр, пробелы, дефис,
 * «ё», одна опечатка. Похожие по смыслу («сай-фай» и «фантастика») сюда не попадают — свести их
 * может только человек, и подсказка, зовущая объединить однофамильцев, хуже её отсутствия.
 */

export interface NamedEntry {
  id: string;
  name: string;
  /** Имя в оригинале: у автора оно и есть второй способ записать то же самое. */
  altName?: string;
  itemCount: number;
}

export interface DuplicatePair<T extends NamedEntry> {
  /** Тот, к кому присоединяют: у него записей больше, и его имя остаётся. */
  target: T;
  source: T;
  /** Чем похожи — подсказка объясняет, почему спрашивает. */
  reason: 'same' | 'alt' | 'typo';
}

/** Ё и Е — одна буква; дефисы, пробелы и точки при вводе ставят как придётся. */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s'’`.,\-–—_]/g, '');

/** Расстояние Левенштейна, но дальше двух не считается: три различия — уже другое имя. */
const withinOneEdit = (left: string, right: string) => {
  if (Math.abs(left.length - right.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (left.length < right.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
};

/** Опечатку ищем только в длинных именах: у «Дюна» и «Луна» разница тоже в одну букву. */
const TYPO_MIN_LENGTH = 6;

const reasonFor = <T extends NamedEntry>(left: T, right: T): DuplicatePair<T>['reason'] | undefined => {
  const leftName = normalize(left.name);
  const rightName = normalize(right.name);
  if (!leftName || !rightName) return undefined;
  if (leftName === rightName) return 'same';

  const alt = [left.altName, right.altName].filter(Boolean).map((value) => normalize(value as string));
  if (alt.includes(leftName) || alt.includes(rightName)) return 'alt';

  if (leftName.length >= TYPO_MIN_LENGTH && withinOneEdit(leftName, rightName)) return 'typo';

  return undefined;
};

/**
 * Пары-кандидаты, сильные первыми: чем больше записей за парой, тем заметнее беспорядок.
 * Каждая запись попадает не больше чем в одну пару — иначе объединение первой ломает вторую.
 */
export const findDuplicates = <T extends NamedEntry>(entries: T[]): DuplicatePair<T>[] => {
  const pairs: DuplicatePair<T>[] = [];
  const taken = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i];
      const right = entries[j];
      if (taken.has(left.id) || taken.has(right.id)) continue;

      const reason = reasonFor(left, right);
      if (!reason) continue;

      // Остаётся тот, за кем больше записей: переподвесить меньшее — меньше работы и меньше риска.
      const [target, source] = left.itemCount >= right.itemCount ? [left, right] : [right, left];
      pairs.push({ target, source, reason });
      taken.add(left.id);
      taken.add(right.id);
    }
  }

  return pairs.sort((a, b) => b.target.itemCount + b.source.itemCount - (a.target.itemCount + a.source.itemCount));
};
