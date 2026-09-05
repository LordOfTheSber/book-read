import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BookAnalytics, ReadingAnalytics } from '@/shared/types/library';
import { fetchBookAnalytics, fetchReadingAnalytics } from '../api/analyticsApi';

interface AnalyticsState {
  data?: BookAnalytics;
  loading: boolean;
  error?: string;
  /**
   * Аналитика во времени грузится отдельным запросом и своим флагом: она нужна только странице
   * аналитики, а сводка выше — ещё и списку книг с профилем.
   */
  reading?: ReadingAnalytics;
  readingLoading: boolean;
  readingError?: string;
  currentUserId?: string;
}

const initialState: AnalyticsState = {
  loading: false,
  readingLoading: false
};

export const loadBookAnalytics = createAsyncThunk(
  'analytics/loadBookAnalytics',
  async (userId?: string) => fetchBookAnalytics(userId)
);

export const loadReadingAnalytics = createAsyncThunk(
  'analytics/loadReadingAnalytics',
  async (userId?: string) => fetchReadingAnalytics(userId)
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
      })
      .addCase(loadReadingAnalytics.pending, (state) => {
        state.readingLoading = true;
        state.readingError = undefined;
      })
      .addCase(loadReadingAnalytics.fulfilled, (state, action: PayloadAction<ReadingAnalytics>) => {
        state.readingLoading = false;
        state.reading = action.payload;
      })
      .addCase(loadReadingAnalytics.rejected, (state, action) => {
        state.readingLoading = false;
        state.readingError = action.error.message;
      });
  }
});

export const analyticsActions = analyticsSlice.actions;
export const analyticsReducer = analyticsSlice.reducer;
export type { AnalyticsState };
