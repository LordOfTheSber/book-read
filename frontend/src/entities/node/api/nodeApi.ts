import { httpClient } from '@/shared/api/httpClient';
import { SystemNode } from '@/shared/types/library';

export const fetchNodes = async (): Promise<SystemNode[]> => {
  const { data } = await httpClient.get<SystemNode[]>('/nodes');
  return data;
};
