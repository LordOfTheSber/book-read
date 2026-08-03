import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthSession {
  id: string;
  expiresAt: string;
  maxExpiresAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  session?: AuthSession;
}

export const login = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/login', payload);
  return data;
};

export const register = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/register', payload);
  return data;
};

/** Завершает серверную сессию. Ошибку глушим: локальный выход должен произойти в любом случае. */
export const logout = async (): Promise<void> => {
  await httpClient.post('/auth/logout').catch(() => undefined);
};

export const fetchMe = async (): Promise<User> => {
  const { data } = await httpClient.get<User>('/users/me');
  return data;
};

export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await httpClient.put<User>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return data;
};
