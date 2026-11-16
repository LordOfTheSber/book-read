import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SmartShelf } from '@/shared/types/library';
import { createSmartShelf, deleteSmartShelf, fetchSmartShelves, SmartShelfPayload, updateSmartShelf } from '../api/smartShelfApi';

export interface SmartShelfState {
  list: SmartShelf[];
  loading: boolean;
  loaded: boolean;
  error?: string;
}

const initialState: SmartShelfState = {
  list: [],
  loading: false,
  loaded: false
};

export const loadSmartShelves = createAsyncThunk<SmartShelf[], { force?: boolean } | undefined>(
  'smartShelves/load',
  async () => fetchSmartShelves(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { smartShelves: SmartShelfState };
      if (payload?.force) return true;
      return !state.smartShelves.loaded && !state.smartShelves.loading;
    }
  }
);

export const createSmartShelfThunk = createAsyncThunk('smartShelves/create', async (payload: SmartShelfPayload) =>
  createSmartShelf(payload)
);
export const updateSmartShelfThunk = createAsyncThunk(
  'smartShelves/update',
  async ({ id, payload }: { id: string; payload: SmartShelfPayload }) => updateSmartShelf(id, payload)
);
export const deleteSmartShelfThunk = createAsyncThunk('smartShelves/delete', async (id: string) => {
  await deleteSmartShelf(id);
  return id;
});

const smartShelfSlice = createSlice({
  name: 'smartShelves',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSmartShelves.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSmartShelves.fulfilled, (state, action: PayloadAction<SmartShelf[]>) => {
        state.loading = false;
        state.loaded = true;
        state.list = action.payload;
      })
      .addCase(loadSmartShelves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createSmartShelfThunk.fulfilled, (state, action: PayloadAction<SmartShelf>) => {
        state.list = [...state.list, action.payload].sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateSmartShelfThunk.fulfilled, (state, action: PayloadAction<SmartShelf>) => {
        state.list = state.list.map((shelf) => (shelf.id === action.payload.id ? action.payload : shelf));
      })
      .addCase(deleteSmartShelfThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((shelf) => shelf.id !== action.payload);
      });
  }
});

export const smartShelfReducer = smartShelfSlice.reducer;
