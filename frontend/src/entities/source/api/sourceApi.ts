import { httpClient } from '@/shared/api/httpClient';
import { Source } from '@/shared/types/library';

export const fetchSources = async () => {
  const { data } = await httpClient.get<Source[]>('/sources');
  return data;
};

export const createSource = async (payload: Partial<Source>) => {
  const { data } = await httpClient.post<Source>('/sources', payload);
  return data;
};

export const updateSource = async (id: string, payload: Partial<Source>) => {
  const { data } = await httpClient.put<Source>(`/sources/${id}`, payload);
  return data;
};

export const deleteSource = async (id: string) => {
  await httpClient.delete(`/sources/${id}`);
};
