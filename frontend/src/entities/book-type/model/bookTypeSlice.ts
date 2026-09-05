import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BookType } from '@/shared/types/library';
import { createBookType, deleteBookType, fetchBookTypes, updateBookType } from '../api/bookTypeApi';

interface BookTypeState {
  list: BookType[];
  loading: boolean;
  error?: string;
  loaded: boolean;
}

const initialState: BookTypeState = {
  list: [],
  loading: false,
  loaded: false
};

/** `force` — когда справочник мог пополниться мимо этого списка: из карточки или соседней страницы. */
export const loadBookTypes = createAsyncThunk<BookType[], { force?: boolean } | undefined>(
  'bookTypes/load',
  async () => fetchBookTypes(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { bookTypes: BookTypeState };
      if (payload?.force) return true;
      return !state.bookTypes.loaded && !state.bookTypes.loading;
    }
  }
);
export const createBookTypeThunk = createAsyncThunk('bookTypes/create', async (payload: Partial<BookType>) => createBookType(payload));
export const updateBookTypeThunk = createAsyncThunk('bookTypes/update', async ({ id, payload }: { id: string; payload: Partial<BookType> }) =>
  updateBookType(id, payload)
);
export const deleteBookTypeThunk = createAsyncThunk('bookTypes/delete', async (id: string) => {
  await deleteBookType(id);
  return id;
});

const bookTypeSlice = createSlice({
  name: 'bookTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadBookTypes.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadBookTypes.fulfilled, (state, action: PayloadAction<BookType[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.loaded = true;
      })
      .addCase(loadBookTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createBookTypeThunk.fulfilled, (state, action: PayloadAction<BookType>) => {
        state.list.push(action.payload);
      })
      .addCase(updateBookTypeThunk.fulfilled, (state, action: PayloadAction<BookType>) => {
        state.list = state.list.map((type) => (type.id === action.payload.id ? action.payload : type));
      })
      .addCase(deleteBookTypeThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((type) => type.id !== action.payload);
      });
  }
});

export const bookTypeReducer = bookTypeSlice.reducer;
