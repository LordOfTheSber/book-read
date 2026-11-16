import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export const fetchUsers = async (username?: string): Promise<User[]> => {
  const { data } = await httpClient.get<User[]>('/users', {
    params: username ? { username } : undefined
  });
  return data;
};

export const updateUserSessionSettings = async (
  userId: string,
  payload: { sessionTtlMinutes?: number | null; maxSessionLifetimeMinutes?: number | null }
): Promise<User> => {
  const { data } = await httpClient.put<User>(`/users/${userId}/session-settings`, payload);
  return data;
};

export const clearUserSessionSettings = async (userId: string): Promise<User> => {
  const { data } = await httpClient.delete<User>(`/users/${userId}/session-settings`);
  return data;
};

export const updateUserRole = async (userId: string, role: User['role']): Promise<User> => {
  const { data } = await httpClient.put<User>(`/users/${userId}/role`, { role });
  return data;
};

export const updateUserBlockedStatus = async (userId: string, blocked: boolean): Promise<User> => {
  const { data } = await httpClient.put<User>(`/users/${userId}/block`, { blocked });
  return data;
};
