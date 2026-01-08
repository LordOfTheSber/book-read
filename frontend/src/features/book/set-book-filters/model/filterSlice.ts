import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface BookFilterState {
  q?: string;
  typeId?: string;
  status?: string;
  favorite?: boolean;
  minRating?: number;
  maxRating?: number;
  userId?: string;
  sort?: string;
  page: number;
  size: number;
}

const initialState: BookFilterState = {
  page: 0,
  size: 10,
  sort: 'updatedAt,desc'
};

const filterSlice = createSlice({
  name: 'bookFilters',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<BookFilterState>>) => ({ ...state, ...action.payload }),
    resetFilters: () => initialState
  }
});

export const { setFilters, resetFilters } = filterSlice.actions;
export const bookFilterReducer = filterSlice.reducer;
