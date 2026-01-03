import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/shared/types/library';
import { fetchUsers } from '../api/userApi';

interface UsersState {
  list: User[];
  loading: boolean;
  error?: string;
  loaded: boolean;
}

const initialState: UsersState = {
  list: [],
  loading: false,
  loaded: false
};

export const loadUsers = createAsyncThunk('users/load', async () => fetchUsers(), {
  condition: (_, { getState }) => {
    const state = getState() as { users: UsersState };
    return !state.users.loaded && !state.users.loading;
  }
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadUsers.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadUsers.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.loading = false;
        state.list = action.payload;
        state.loaded = true;
      })
      .addCase(loadUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const usersReducer = usersSlice.reducer;
export type { UsersState };
