import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Source } from '@/shared/types/library';
import { createSource, deleteSource, fetchSources, updateSource } from '../api/sourceApi';

interface SourceState {
  list: Source[];
  loading: boolean;
  error?: string;
  loaded: boolean;
}

const initialState: SourceState = {
  list: [],
  loading: false,
  loaded: false
};

/** `force` — когда справочник мог пополниться мимо этого списка: из карточки или соседней страницы. */
export const loadSources = createAsyncThunk<Source[], { force?: boolean } | undefined>(
  'sources/load',
  async () => fetchSources(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { sources: SourceState };
      if (payload?.force) return true;
      return !state.sources.loaded && !state.sources.loading;
    }
  }
);
export const createSourceThunk = createAsyncThunk('sources/create', async (payload: Partial<Source>) => createSource(payload));
export const updateSourceThunk = createAsyncThunk(
  'sources/update',
  async ({ id, payload }: { id: string; payload: Partial<Source> }) => updateSource(id, payload)
);
export const deleteSourceThunk = createAsyncThunk('sources/delete', async (id: string) => {
  await deleteSource(id);
  return id;
});

const sourceSlice = createSlice({
  name: 'sources',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSources.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSources.fulfilled, (state, action: PayloadAction<Source[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.loaded = true;
      })
      .addCase(loadSources.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createSourceThunk.fulfilled, (state, action: PayloadAction<Source>) => {
        state.list.push(action.payload);
      })
      .addCase(updateSourceThunk.fulfilled, (state, action: PayloadAction<Source>) => {
        state.list = state.list.map((source) => (source.id === action.payload.id ? action.payload : source));
      })
      .addCase(deleteSourceThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((source) => source.id !== action.payload);
      });
  }
});

export const sourceReducer = sourceSlice.reducer;
