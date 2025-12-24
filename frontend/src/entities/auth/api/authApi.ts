import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const login = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/login', payload);
  return data;
};

export const register = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/register', payload);
  return data;
};

export const fetchMe = async (): Promise<User> => {
  const { data } = await httpClient.get<User>('/users/me');
  return data;
};
