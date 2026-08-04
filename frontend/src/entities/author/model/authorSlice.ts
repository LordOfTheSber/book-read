import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Author } from '@/shared/types/library';
import { createAuthor, deleteAuthor, fetchAuthors, updateAuthor } from '../api/authorApi';

export interface AuthorState {
  list: Author[];
  loading: boolean;
  error?: string;
  loaded: boolean;
}

const initialState: AuthorState = {
  list: [],
  loading: false,
  loaded: false
};

export const loadAuthors = createAsyncThunk<Author[], { force?: boolean } | undefined>(
  'authors/load',
  async () => fetchAuthors(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { authors: AuthorState };
      if (payload?.force) return true;
      return !state.authors.loaded && !state.authors.loading;
    }
  }
);

export const createAuthorThunk = createAsyncThunk('authors/create', async (payload: Partial<Author>) =>
  createAuthor(payload)
);
export const updateAuthorThunk = createAsyncThunk(
  'authors/update',
  async ({ id, payload }: { id: string; payload: Partial<Author> }) => updateAuthor(id, payload)
);
export const deleteAuthorThunk = createAsyncThunk('authors/delete', async (id: string) => {
  await deleteAuthor(id);
  return id;
});

const authorSlice = createSlice({
  name: 'authors',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadAuthors.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadAuthors.fulfilled, (state, action: PayloadAction<Author[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.loaded = true;
      })
      .addCase(loadAuthors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createAuthorThunk.fulfilled, (state, action: PayloadAction<Author>) => {
        state.list = [...state.list, action.payload].sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateAuthorThunk.fulfilled, (state, action: PayloadAction<Author>) => {
        state.list = state.list.map((author) => (author.id === action.payload.id ? action.payload : author));
      })
      .addCase(deleteAuthorThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((author) => author.id !== action.payload);
      });
  }
});

export const authorReducer = authorSlice.reducer;
