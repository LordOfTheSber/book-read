import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Shelf } from '@/shared/types/library';
import { addShelfItems, createShelf, deleteShelf, fetchShelves, removeShelfItems, ShelfPayload, updateShelf } from '../api/shelfApi';

export interface ShelfState {
  list: Shelf[];
  loading: boolean;
  loaded: boolean;
  error?: string;
}

const initialState: ShelfState = {
  list: [],
  loading: false,
  loaded: false
};

export const loadShelves = createAsyncThunk<Shelf[], { force?: boolean } | undefined>(
  'shelves/load',
  async () => fetchShelves(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { shelves: ShelfState };
      if (payload?.force) return true;
      return !state.shelves.loaded && !state.shelves.loading;
    }
  }
);

export const createShelfThunk = createAsyncThunk('shelves/create', async (payload: ShelfPayload) => createShelf(payload));
export const updateShelfThunk = createAsyncThunk('shelves/update', async ({ id, payload }: { id: string; payload: ShelfPayload }) =>
  updateShelf(id, payload)
);
export const deleteShelfThunk = createAsyncThunk('shelves/delete', async (id: string) => {
  await deleteShelf(id);
  return id;
});
export const addShelfItemsThunk = createAsyncThunk('shelves/addItems', async ({ id, itemIds }: { id: string; itemIds: string[] }) =>
  addShelfItems(id, itemIds)
);
export const removeShelfItemsThunk = createAsyncThunk('shelves/removeItems', async ({ id, itemIds }: { id: string; itemIds: string[] }) =>
  removeShelfItems(id, itemIds)
);

const replace = (state: ShelfState, shelf: Shelf) => {
  state.list = state.list.map((item) => (item.id === shelf.id ? shelf : item));
};

const shelfSlice = createSlice({
  name: 'shelves',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadShelves.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadShelves.fulfilled, (state, action: PayloadAction<Shelf[]>) => {
        state.loading = false;
        state.loaded = true;
        state.list = action.payload;
      })
      .addCase(loadShelves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createShelfThunk.fulfilled, (state, action: PayloadAction<Shelf>) => {
        state.list = [...state.list, action.payload].sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateShelfThunk.fulfilled, (state, action: PayloadAction<Shelf>) => replace(state, action.payload))
      .addCase(addShelfItemsThunk.fulfilled, (state, action: PayloadAction<Shelf>) => replace(state, action.payload))
      .addCase(removeShelfItemsThunk.fulfilled, (state, action: PayloadAction<Shelf>) => replace(state, action.payload))
      .addCase(deleteShelfThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((shelf) => shelf.id !== action.payload);
      });
  }
});

export const shelfReducer = shelfSlice.reducer;
