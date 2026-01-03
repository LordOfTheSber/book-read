import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export const fetchUsers = async (): Promise<User[]> => {
  const { data } = await httpClient.get<User[]>('/users');
  return data;
};
