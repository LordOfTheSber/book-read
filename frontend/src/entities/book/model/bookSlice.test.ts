import { describe, expect, it } from 'vitest';
import { bookReducer, createBookThunk, deleteBookThunk, loadBooks, updateBookThunk } from '@/entities/book';
import { LibraryItem } from '@/shared/types/library';

const book = (id: string, title: string): LibraryItem =>
  ({ id, title, status: 'PLANNED', favorite: false }) as LibraryItem;

const stateWith = (...items: LibraryItem[]) =>
  bookReducer(undefined, {
    type: loadBooks.fulfilled.type,
    payload: { content: items, page: 0, size: 20, totalElements: items.length, totalPages: 1 }
  });

describe('bookSlice', () => {
  it('складывает выдачу страницы в состояние', () => {
    const state = stateWith(book('1', 'Первая'), book('2', 'Вторая'));

    expect(state.items).toHaveLength(2);
    expect(state.total).toBe(2);
    expect(state.loading).toBe(false);
  });

  it('запоминает ошибку загрузки и снимает флаг', () => {
    const state = bookReducer(undefined, { type: loadBooks.rejected.type, error: { message: 'Сеть недоступна' } });

    expect(state.loading).toBe(false);
    expect(state.error).toBe('Сеть недоступна');
  });

  it('ставит созданную книгу в начало списка', () => {
    const state = bookReducer(stateWith(book('1', 'Первая')), {
      type: createBookThunk.fulfilled.type,
      payload: book('2', 'Новая')
    });

    expect(state.items.map((item) => item.id)).toEqual(['2', '1']);
    expect(state.total).toBe(2);
  });

  it('заменяет отредактированную книгу на месте', () => {
    const state = bookReducer(stateWith(book('1', 'Первая'), book('2', 'Вторая')), {
      type: updateBookThunk.fulfilled.type,
      payload: book('1', 'Переименована')
    });

    expect(state.items.map((item) => item.title)).toEqual(['Переименована', 'Вторая']);
    expect(state.total).toBe(2);
  });

  it('убирает удалённую книгу и уменьшает счётчик', () => {
    const state = bookReducer(stateWith(book('1', 'Первая'), book('2', 'Вторая')), {
      type: deleteBookThunk.fulfilled.type,
      payload: '1'
    });

    expect(state.items.map((item) => item.id)).toEqual(['2']);
    expect(state.total).toBe(1);
  });
});
