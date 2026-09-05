import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookRequestFields } from './requestFields';

/**
 * Договор карточки с сервером. Единственный способ узнать, что поле формы не доезжает до базы, —
 * заметить это на проме, поэтому список полей запроса сверяется с серверным DTO прямо здесь.
 *
 * Поля, которых в списке нет намеренно, перечислены отдельно: молчаливое расхождение — это ровно
 * тот случай, когда пользователь вводит данные, видит «Запись добавлена» и теряет половину.
 */
const DTO_PATH = resolve(
  process.cwd(),
  '../backend/src/main/java/com/library/tracker/web/dto/LibraryItemRequest.java'
);

/** Прогресс двигают заходы и смена статуса — карточка его не присылает и не должна. */
const serverOnlyFields = ['progressCurrent'];

const readDtoFields = (): string[] => {
  const source = readFileSync(DTO_PATH, 'utf8');
  // `private <тип> <имя>` — в DTO нет ни статических полей, ни вложенных классов.
  return [...source.matchAll(/^\s*private\s+[\w.<>, ]+?\s+(\w+)\s*(?:=|;)/gm)].map((match) => match[1]);
};

describe('поля запроса карточки', () => {
  it('совпадают с тем, что принимает сервер', () => {
    const dtoFields = readDtoFields();

    expect(dtoFields.length).toBeGreaterThan(20);
    expect([...bookRequestFields].sort()).toEqual(
      dtoFields.filter((field) => !serverOnlyFields.includes(field)).sort()
    );
  });

  it('не содержат повторов', () => {
    expect(new Set(bookRequestFields).size).toBe(bookRequestFields.length);
  });
});
