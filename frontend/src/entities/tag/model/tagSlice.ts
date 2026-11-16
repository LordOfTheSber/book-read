import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Tag } from '@/shared/types/library';
import { createTag, deleteTag, fetchTags, mergeTags, TagPayload, updateTag } from '../api/tagApi';

export interface TagState {
  list: Tag[];
  loading: boolean;
  loaded: boolean;
  error?: string;
}

const initialState: TagState = {
  list: [],
  loading: false,
  loaded: false
};

/**
 * Теги нужны и в карточке, и в фильтрах, и в массовых операциях, поэтому грузятся один раз;
 * `force` — для случая, когда тег завёлся по ходу сохранения карточки.
 */
export const loadTags = createAsyncThunk<Tag[], { force?: boolean } | undefined>('tags/load', async () => fetchTags(), {
  condition: (payload, { getState }) => {
    const state = getState() as { tags: TagState };
    if (payload?.force) return true;
    return !state.tags.loaded && !state.tags.loading;
  }
});

export const createTagThunk = createAsyncThunk('tags/create', async (payload: TagPayload) => createTag(payload));
export const updateTagThunk = createAsyncThunk('tags/update', async ({ id, payload }: { id: string; payload: TagPayload }) =>
  updateTag(id, payload)
);
/** Объединение дублей: остающийся тег обновляется счётчиком, уходящий пропадает из списка. */
export const mergeTagsThunk = createAsyncThunk(
  'tags/merge',
  async ({ targetId, sourceId }: { targetId: string; sourceId: string }) => ({
    target: await mergeTags(targetId, sourceId),
    sourceId
  })
);

export const deleteTagThunk = createAsyncThunk('tags/delete', async (id: string) => {
  await deleteTag(id);
  return id;
});

const tagSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadTags.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadTags.fulfilled, (state, action: PayloadAction<Tag[]>) => {
        state.loading = false;
        state.loaded = true;
        state.list = action.payload;
      })
      .addCase(loadTags.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createTagThunk.fulfilled, (state, action: PayloadAction<Tag>) => {
        state.list = [...state.list, action.payload].sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateTagThunk.fulfilled, (state, action: PayloadAction<Tag>) => {
        state.list = state.list.map((tag) => (tag.id === action.payload.id ? action.payload : tag));
      })
      .addCase(mergeTagsThunk.fulfilled, (state, action: PayloadAction<{ target: Tag; sourceId: string }>) => {
        state.list = state.list
          .filter((tag) => tag.id !== action.payload.sourceId)
          .map((tag) => (tag.id === action.payload.target.id ? action.payload.target : tag));
      })
      .addCase(deleteTagThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.list = state.list.filter((tag) => tag.id !== action.payload);
      });
  }
});

export const tagReducer = tagSlice.reducer;
