import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NodeMemoryDetail, SystemNode } from '@/shared/types/library';
import { fetchNodeById, fetchNodeMemoryDetail, fetchNodes } from '../api/nodeApi';

interface NodesState {
  list: SystemNode[];
  loading: boolean;
  error?: string;
  lastUpdated?: string;
  currentNode?: SystemNode;
  currentNodeLoading: boolean;
  memoryDetail?: NodeMemoryDetail;
  memoryDetailLoading: boolean;
}

const initialState: NodesState = {
  list: [],
  loading: false,
  currentNodeLoading: false,
  memoryDetailLoading: false
};

export const loadNodes = createAsyncThunk('nodes/load', async () => fetchNodes(), {
  condition: (_, { getState }) => {
    const state = getState() as { nodes: NodesState };
    return !state.nodes.loading;
  }
});

export const loadNodeById = createAsyncThunk('nodes/loadById', async (nodeId: string) =>
  fetchNodeById(nodeId)
);

export const loadNodeMemoryDetail = createAsyncThunk(
  'nodes/loadMemoryDetail',
  async (nodeId: string) => fetchNodeMemoryDetail(nodeId)
);

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {
    clearCurrentNode(state) {
      state.currentNode = undefined;
      state.memoryDetail = undefined;
    }
  },
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
      })
      .addCase(loadNodeById.pending, (state) => {
        state.currentNodeLoading = true;
        state.error = undefined;
      })
      .addCase(loadNodeById.fulfilled, (state, action: PayloadAction<SystemNode>) => {
        state.currentNodeLoading = false;
        state.currentNode = action.payload;
      })
      .addCase(loadNodeById.rejected, (state, action) => {
        state.currentNodeLoading = false;
        state.error = action.error.message;
      })
      .addCase(loadNodeMemoryDetail.pending, (state) => {
        state.memoryDetailLoading = true;
      })
      .addCase(loadNodeMemoryDetail.fulfilled, (state, action: PayloadAction<NodeMemoryDetail>) => {
        state.memoryDetailLoading = false;
        state.memoryDetail = action.payload;
      })
      .addCase(loadNodeMemoryDetail.rejected, (state, action) => {
        state.memoryDetailLoading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentNode } = nodesSlice.actions;
export const nodesReducer = nodesSlice.reducer;
export type { NodesState };
