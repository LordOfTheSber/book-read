import { beforeEach, describe, expect, it } from 'vitest';
import { authActions, authReducer, fetchCurrentUser } from '@/entities/auth';
import { isAuthSessionActive } from '@/shared/api/authSession';
import { User } from '@/shared/types/library';

const user: User = { id: 'u-1', username: 'alex', role: 'USER' } as User;

const initialState = () => authReducer(undefined, { type: '@@INIT' });

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('запоминает вход без токена в состоянии', () => {
    const state = authReducer(initialState(), authActions.setCredentials({ user }));

    expect(state.authenticated).toBe(true);
    expect(state.user).toEqual(user);
    // Токен ездит в httpOnly-куке, приложению он недоступен и храниться не должен.
    expect(state).not.toHaveProperty('token');
    expect(isAuthSessionActive()).toBe(true);
  });

  it('стирает признак сессии при выходе', () => {
    const loggedIn = authReducer(initialState(), authActions.setCredentials({ user }));

    const state = authReducer(loggedIn, authActions.logout());

    expect(state.authenticated).toBe(false);
    expect(state.user).toBeUndefined();
    expect(isAuthSessionActive()).toBe(false);
  });

  /** Флаг в localStorage переживает перезагрузку, а сессия на сервере — нет. */
  it('сбрасывает сессию, если /users/me не ответил', () => {
    const loggedIn = authReducer(initialState(), authActions.setCredentials({ user }));

    const state = authReducer(loggedIn, { type: fetchCurrentUser.rejected.type, error: { message: '401' } });

    expect(state.authenticated).toBe(false);
    expect(state.loadingUser).toBe(false);
    expect(isAuthSessionActive()).toBe(false);
  });

  it('поднимает флаг загрузки на время запроса профиля', () => {
    const state = authReducer(initialState(), { type: fetchCurrentUser.pending.type });

    expect(state.loadingUser).toBe(true);
  });
});
