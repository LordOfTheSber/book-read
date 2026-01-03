import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BookAnalytics } from '@/shared/types/library';
import { fetchBookAnalytics } from '../api/analyticsApi';

interface AnalyticsState {
  data?: BookAnalytics;
  loading: boolean;
  error?: string;
  currentUserId?: string;
}

const initialState: AnalyticsState = {
  loading: false
};

export const loadBookAnalytics = createAsyncThunk(
  'analytics/loadBookAnalytics',
  async (userId?: string) => fetchBookAnalytics(userId)
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setTargetUser: (state, action: PayloadAction<string | undefined>) => {
      state.currentUserId = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBookAnalytics.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadBookAnalytics.fulfilled, (state, action: PayloadAction<BookAnalytics>) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(loadBookAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const analyticsActions = analyticsSlice.actions;
export const analyticsReducer = analyticsSlice.reducer;
export type { AnalyticsState };
