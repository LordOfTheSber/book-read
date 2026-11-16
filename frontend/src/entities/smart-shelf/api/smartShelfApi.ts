import { httpClient } from '@/shared/api/httpClient';
import { SavedFilter, SmartShelf } from '@/shared/types/library';

export interface SmartShelfPayload {
  name: string;
  description?: string;
  filter: SavedFilter;
}

export const fetchSmartShelves = async () => {
  const { data } = await httpClient.get<SmartShelf[]>('/smart-shelves');
  return data;
};

export const createSmartShelf = async (payload: SmartShelfPayload) => {
  const { data } = await httpClient.post<SmartShelf>('/smart-shelves', payload);
  return data;
};

export const updateSmartShelf = async (id: string, payload: SmartShelfPayload) => {
  const { data } = await httpClient.put<SmartShelf>(`/smart-shelves/${id}`, payload);
  return data;
};

export const deleteSmartShelf = async (id: string) => {
  await httpClient.delete(`/smart-shelves/${id}`);
};
