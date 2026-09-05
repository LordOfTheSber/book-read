import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Series } from '@/shared/types/library';
import { createSeries, deleteSeries, fetchSeries, updateSeries } from '../api/seriesApi';

export interface SeriesState {
  list: Series[];
  loading: boolean;
  error?: string;
  loaded: boolean;
}

const initialState: SeriesState = {
  list: [],
  loading: false,
  loaded: false
};

export const loadSeries = createAsyncThunk<Series[], { force?: boolean } | undefined>(
  'series/load',
  async () => fetchSeries(),
  {
    condition: (payload, { getState }) => {
      const state = getState() as { series: SeriesState };
      if (payload?.force) return true;
      return !state.series.loaded && !state.series.loading;
    }
  }
);

export const createSeriesThunk = createAsyncThunk('series/create', async (payload: Partial<Series>) =>
  createSeries(payload)
);
export const updateSeriesThunk = createAsyncThunk(
  'series/update',
  async ({ id, payload }: { id: string; payload: Partial<Series> }) => updateSeries(id, payload)
);
export const deleteSeriesThunk = createAsyncThunk('series/delete', async (id: string) => {
  await deleteSeries(id);
  return id;
});

const seriesSlice = createSlice({
  name: 'series',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSeries.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSeries.fulfilled, (state, action: PayloadAction<Series[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.loaded = true;
      })
      .addCase(loadSeries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createSeriesThunk.fulfilled, (state, action: PayloadAction<Series>) => {
        state.list = [...state.list, action.payload].sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateSeriesThunk.fulfilled, (state, action: PayloadAction<Series>) => {
        state.list = state.list.map((series) => (series.id === action.payload.id ? action.payload : series));
      })
      .addCase(deleteSeriesThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((series) => series.id !== action.payload);
      });
  }
});

export const seriesReducer = seriesSlice.reducer;
