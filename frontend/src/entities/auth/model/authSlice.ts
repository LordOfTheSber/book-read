import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/shared/types/library';

export interface AuthState {
  user?: User;
  token?: string;
}

const storedToken = localStorage.getItem('authToken') || undefined;
const storedUser = localStorage.getItem('authUser');

const initialState: AuthState = {
  token: storedToken,
  user: storedUser ? (JSON.parse(storedUser) as User) : undefined
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('authToken', action.payload.token);
      localStorage.setItem('authUser', JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.user = undefined;
      state.token = undefined;
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
  }
});

export const { reducer: authReducer, actions: authActions } = authSlice;
