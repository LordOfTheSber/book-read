import { httpClient } from '@/shared/api/httpClient';
import { Series } from '@/shared/types/library';

export const fetchSeries = async () => {
  const { data } = await httpClient.get<Series[]>('/series');
  return data;
};

export const createSeries = async (payload: Partial<Series>) => {
  const { data } = await httpClient.post<Series>('/series', payload);
  return data;
};

export const updateSeries = async (id: string, payload: Partial<Series>) => {
  const { data } = await httpClient.put<Series>(`/series/${id}`, payload);
  return data;
};

export const deleteSeries = async (id: string) => {
  await httpClient.delete(`/series/${id}`);
};
