import { describe, expect, it } from 'vitest';
import { bookFilterReducer, resetFilters, setFilters } from '@/features/book/set-book-filters';

const initialState = () => bookFilterReducer(undefined, { type: '@@INIT' });

describe('bookFilterSlice', () => {
  it('дополняет текущие фильтры, а не заменяет их', () => {
    const withStatus = bookFilterReducer(initialState(), setFilters({ status: 'READING' }));

    const state = bookFilterReducer(withStatus, setFilters({ favorite: true }));

    expect(state.status).toBe('READING');
    expect(state.favorite).toBe(true);
    expect(state.sort).toBe('updatedAt,desc');
  });

  it('возвращает состояние по умолчанию при сбросе', () => {
    const filtered = bookFilterReducer(
      initialState(),
      setFilters({ status: 'READING', favorite: true, minRating: 8, page: 3 })
    );

    expect(bookFilterReducer(filtered, resetFilters())).toEqual(initialState());
  });

  it('позволяет снять фильтр, передав undefined', () => {
    const filtered = bookFilterReducer(initialState(), setFilters({ status: 'READING' }));

    const state = bookFilterReducer(filtered, setFilters({ status: undefined }));

    expect(state.status).toBeUndefined();
  });
});
