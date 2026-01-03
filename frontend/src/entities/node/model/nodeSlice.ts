import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SystemNode } from '@/shared/types/library';
import { fetchNodes } from '../api/nodeApi';

interface NodesState {
  list: SystemNode[];
  loading: boolean;
  error?: string;
  lastUpdated?: string;
}

const initialState: NodesState = {
  list: [],
  loading: false
};

export const loadNodes = createAsyncThunk('nodes/load', async () => fetchNodes(), {
  condition: (_, { getState }) => {
    const state = getState() as { nodes: NodesState };
    return !state.nodes.loading;
  }
});

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadNodes.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadNodes.fulfilled, (state, action: PayloadAction<SystemNode[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadNodes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const nodesReducer = nodesSlice.reducer;
export type { NodesState };
