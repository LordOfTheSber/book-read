import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LibraryItem, PageResponse } from '@/shared/types/library';
import { createBook, deleteBook, fetchBooks, FetchBooksParams, updateBook } from '../api/bookApi';

export interface BookState {
  items: LibraryItem[];
  page: number;
  size: number;
  total: number;
  loading: boolean;
  error?: string;
}

const initialState: BookState = {
  items: [],
  page: 0,
  size: 20,
  total: 0,
  loading: false
};

export const loadBooks = createAsyncThunk<PageResponse<LibraryItem>, FetchBooksParams>('books/load', async (params) => {
  return fetchBooks(params);
});

export const createBookThunk = createAsyncThunk('books/create', async (payload: Partial<LibraryItem>) => {
  return createBook(payload);
});

export const updateBookThunk = createAsyncThunk('books/update', async ({ id, payload }: { id: string; payload: Partial<LibraryItem> }) => {
  return updateBook(id, payload);
});

export const deleteBookThunk = createAsyncThunk('books/delete', async (id: string) => {
  await deleteBook(id);
  return id;
});

const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadBooks.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadBooks.fulfilled, (state, action: PayloadAction<PageResponse<LibraryItem>>) => {
        state.loading = false;
        state.items = action.payload.content;
        state.page = action.payload.page;
        state.size = action.payload.size;
        state.total = action.payload.totalElements;
      })
      .addCase(loadBooks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteBookThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  }
});

export const bookReducer = bookSlice.reducer;
