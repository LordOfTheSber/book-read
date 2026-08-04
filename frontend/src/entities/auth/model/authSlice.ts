import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/shared/types/library';
import { clearAuthSession, isAuthSessionActive, markAuthSessionActive } from '@/shared/api/authSession';
import { fetchMe, AuthResponse, logout, uploadAvatar } from '../api/authApi';

export interface AuthState {
  user?: User;
  /** Токен приложению недоступен, поэтому вход отслеживается флагом. */
  authenticated: boolean;
  loadingUser: boolean;
  updatingAvatar: boolean;
}

const initialState: AuthState = {
  authenticated: isAuthSessionActive(),
  user: undefined,
  loadingUser: false,
  updatingAvatar: false
};

export const fetchCurrentUser = createAsyncThunk<User>('auth/fetchCurrentUser', async () => {
  return fetchMe();
});

export const uploadAvatarThunk = createAsyncThunk<User, File>('auth/uploadAvatar', async (file) => {
  return uploadAvatar(file);
});

/** Сначала гасит серверную сессию, затем сбрасывает локальное состояние. */
export const logoutThunk = createAsyncThunk<void>('auth/logout', async () => {
  await logout();
});

const clearSession = (state: AuthState) => {
  state.user = undefined;
  state.authenticated = false;
  clearAuthSession();
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user;
      state.authenticated = true;
      markAuthSessionActive();
    },
    logout: clearSession
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loadingUser = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.authenticated = true;
        markAuthSessionActive();
        state.loadingUser = false;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loadingUser = false;
        clearSession(state);
      })
      .addCase(logoutThunk.fulfilled, clearSession)
      .addCase(logoutThunk.rejected, clearSession)
      .addCase(uploadAvatarThunk.pending, (state) => {
        state.updatingAvatar = true;
      })
      .addCase(uploadAvatarThunk.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.updatingAvatar = false;
      })
      .addCase(uploadAvatarThunk.rejected, (state) => {
        state.updatingAvatar = false;
      });
  }
});

export const { reducer: authReducer, actions: authActions } = authSlice;
