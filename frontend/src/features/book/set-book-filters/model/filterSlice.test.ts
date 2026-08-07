import { describe, expect, it } from 'vitest';
import { applySavedFilter, bookFilterReducer, resetFilters, setFilters, toSavedFilter } from '@/features/book/set-book-filters';

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

  /**
   * Умная полка — это сохранённый фильтр целиком. Если применять его поверх текущего, к полке
   * «непрочитанное» прилипнет фильтр по автору, выставленный минуту назад.
   */
  it('применяет умную полку поверх сброшенного состояния', () => {
    const dirty = bookFilterReducer(
      initialState(),
      setFilters({ authorId: 'a-1', favorite: true, page: 4, status: 'COMPLETED' })
    );

    const state = bookFilterReducer(dirty, applySavedFilter({ status: 'PLANNED', tagId: 't-1' }));

    expect(state.status).toBe('PLANNED');
    expect(state.tagId).toBe('t-1');
    expect(state.authorId).toBeUndefined();
    expect(state.favorite).toBeUndefined();
    // Листание к самой полке не относится: открывается она с первой страницы.
    expect(state.page).toBe(0);
  });

  it('сохраняет текущую выдачу в фильтр полки без параметров листания', () => {
    const filtered = bookFilterReducer(
      initialState(),
      setFilters({ q: 'фантастика', tagId: 't-1', shelfId: 's-1', wishlist: true, page: 2 })
    );

    const saved = toSavedFilter(filtered);

    expect(saved).toMatchObject({ query: 'фантастика', tagId: 't-1', shelfId: 's-1', wishlist: true });
    expect(saved).not.toHaveProperty('page');
    // Обратное применение должно вернуть ту же выдачу.
    expect(bookFilterReducer(initialState(), applySavedFilter(saved))).toMatchObject({
      q: 'фантастика',
      tagId: 't-1',
      shelfId: 's-1',
      wishlist: true
    });
  });
});
