import { httpClient } from '@/shared/api/httpClient';
import { Series, Showcase } from '@/shared/types/library';

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

/** Обложки для карточек цикла — тем же способом, что у авторов: по показанной странице. */
export const fetchSeriesShowcase = async (ids: string[]) => {
  if (ids.length === 0) return {};
  const { data } = await httpClient.get<Showcase>('/series/showcase', { params: { ids: ids.join(',') } });
  return data;
};

export const deleteSeries = async (id: string) => {
  await httpClient.delete(`/series/${id}`);
};
