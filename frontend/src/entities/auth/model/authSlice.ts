import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/shared/types/library';
import { fetchMe, AuthResponse } from '../api/authApi';

export interface AuthState {
  user?: User;
  token?: string;
  loadingUser: boolean;
}

const storedToken = localStorage.getItem('authToken') || undefined;

const initialState: AuthState = {
  token: storedToken,
  user: undefined,
  loadingUser: false
};

export const fetchCurrentUser = createAsyncThunk<User>('auth/fetchCurrentUser', async () => {
  return fetchMe();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('authToken', action.payload.token);
    },
    logout(state) {
      state.user = undefined;
      state.token = undefined;
      localStorage.removeItem('authToken');
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loadingUser = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.loadingUser = false;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loadingUser = false;
        state.user = undefined;
        state.token = undefined;
        localStorage.removeItem('authToken');
      });
  }
});

export const { reducer: authReducer, actions: authActions } = authSlice;
