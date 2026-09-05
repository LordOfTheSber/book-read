import { describe, expect, it } from 'vitest';
import {
  authorReducer,
  createAuthorThunk,
  deleteAuthorThunk,
  loadAuthors,
  mergeAuthorsThunk,
  updateAuthorThunk
} from '@/entities/author';
import { Author } from '@/shared/types/library';

const author = (id: string, name: string, itemCount = 0): Author =>
  ({ id, name, itemCount }) as Author;

const loaded = (...list: Author[]) => authorReducer(undefined, { type: loadAuthors.fulfilled.type, payload: list });

describe('authorSlice', () => {
  it('запоминает загруженный справочник', () => {
    const state = loaded(author('1', 'Лю Цысинь', 3));

    expect(state.list).toHaveLength(1);
    expect(state.list[0].itemCount).toBe(3);
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
  });

  /** Список выводится как справочник, поэтому новый автор должен встать по алфавиту. */
  it('вставляет созданного автора в алфавитном порядке', () => {
    const state = authorReducer(loaded(author('1', 'Брендон Сандерсон')), {
      type: createAuthorThunk.fulfilled.type,
      payload: author('2', 'Аркадий Стругацкий')
    });

    expect(state.list.map((item) => item.name)).toEqual(['Аркадий Стругацкий', 'Брендон Сандерсон']);
  });

  it('заменяет отредактированного автора на месте', () => {
    const state = authorReducer(loaded(author('1', 'Лю Цысинь'), author('2', 'Аркадий Стругацкий')), {
      type: updateAuthorThunk.fulfilled.type,
      payload: author('1', 'Liu Cixin')
    });

    expect(state.list.map((item) => item.name)).toEqual(['Liu Cixin', 'Аркадий Стругацкий']);
  });

  /** Слияние трогает обе строки разом: уходящий пропадает, остающийся получает его записи. */
  it('после слияния оставляет одного автора с новым счётчиком', () => {
    const state = authorReducer(loaded(author('1', 'Лю Цысинь', 6), author('2', 'Cixin Liu', 2)), {
      type: mergeAuthorsThunk.fulfilled.type,
      payload: { target: author('1', 'Лю Цысинь', 8), sourceId: '2' }
    });

    expect(state.list.map((item) => item.id)).toEqual(['1']);
    expect(state.list[0].itemCount).toBe(8);
  });

  it('убирает удалённого автора', () => {
    const state = authorReducer(loaded(author('1', 'Лю Цысинь'), author('2', 'Аркадий Стругацкий')), {
      type: deleteAuthorThunk.fulfilled.type,
      payload: '1'
    });

    expect(state.list.map((item) => item.id)).toEqual(['2']);
  });
});
