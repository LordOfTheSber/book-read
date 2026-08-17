import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SavedFilter } from '@/shared/types/library';

export interface BookFilterState {
  q?: string;
  kind?: string;
  typeId?: string;
  authorId?: string;
  seriesId?: string;
  tagId?: string;
  shelfId?: string;
  status?: string;
  favorite?: boolean;
  /** Список желаемого отдельно от статуса «в планах». */
  wishlist?: boolean;
  minRating?: number;
  maxRating?: number;
  userId?: string;
  sort?: string;
  page: number;
  size: number;
}

/** Порядок по умолчанию: к нему же возвращается таблица, когда сортировку в ней сняли. */
export const DEFAULT_BOOK_SORT = 'updatedAt,desc';

const initialState: BookFilterState = {
  page: 0,
  size: 10,
  sort: DEFAULT_BOOK_SORT
};

const filterSlice = createSlice({
  name: 'bookFilters',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<BookFilterState>>) => ({ ...state, ...action.payload }),
    resetFilters: () => initialState,
    /**
     * Умная полка — это сохранённый фильтр целиком, а не поправка к текущему: применяется
     * поверх сброшенного состояния, иначе к нему прилипли бы фильтры, выставленные до открытия.
     */
    applySavedFilter: (state, action: PayloadAction<SavedFilter>) => ({
      ...initialState,
      size: state.size,
      q: action.payload.query,
      typeId: action.payload.typeId,
      status: action.payload.status,
      favorite: action.payload.favorite,
      wishlist: action.payload.wishlist,
      minRating: action.payload.minRating,
      maxRating: action.payload.maxRating,
      kind: action.payload.kind,
      authorId: action.payload.authorId,
      seriesId: action.payload.seriesId,
      tagId: action.payload.tagId,
      shelfId: action.payload.shelfId,
      sort: action.payload.sort ?? initialState.sort
    })
  }
});

/** Обратное преобразование: то, что уходит в умную полку при сохранении текущей выдачи. */
export const toSavedFilter = (filters: BookFilterState): SavedFilter => ({
  query: filters.q,
  typeId: filters.typeId,
  status: filters.status as SavedFilter['status'],
  favorite: filters.favorite,
  wishlist: filters.wishlist,
  minRating: filters.minRating,
  maxRating: filters.maxRating,
  kind: filters.kind as SavedFilter['kind'],
  authorId: filters.authorId,
  seriesId: filters.seriesId,
  tagId: filters.tagId,
  shelfId: filters.shelfId,
  sort: filters.sort
});

export const { setFilters, resetFilters, applySavedFilter } = filterSlice.actions;
export const bookFilterReducer = filterSlice.reducer;
