import { httpClient } from '@/shared/api/httpClient';
import { Shelf, ShelfItem, ShelfMember, ShelfRole } from '@/shared/types/library';

export interface ShelfPayload {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export const fetchShelves = async () => {
  const { data } = await httpClient.get<Shelf[]>('/shelves');
  return data;
};

export const fetchShelfItems = async (id: string) => {
  const { data } = await httpClient.get<ShelfItem[]>(`/shelves/${id}/items`);
  return data;
};

export const createShelf = async (payload: ShelfPayload) => {
  const { data } = await httpClient.post<Shelf>('/shelves', payload);
  return data;
};

export const updateShelf = async (id: string, payload: ShelfPayload) => {
  const { data } = await httpClient.put<Shelf>(`/shelves/${id}`, payload);
  return data;
};

export const addShelfItems = async (id: string, itemIds: string[]) => {
  const { data } = await httpClient.post<Shelf>(`/shelves/${id}/items`, { itemIds });
  return data;
};

export const removeShelfItems = async (id: string, itemIds: string[]) => {
  // Тело у DELETE нестандартно, но состав снимается пачкой, и «по одному id в пути» — хуже.
  const { data } = await httpClient.delete<Shelf>(`/shelves/${id}/items`, { data: { itemIds } });
  return data;
};

export const deleteShelf = async (id: string) => {
  await httpClient.delete(`/shelves/${id}`);
};

export const fetchShelfMembers = async (id: string) => {
  const { data } = await httpClient.get<ShelfMember[]>(`/shelves/${id}/members`);
  return data;
};

/** Повторный вызов с другой ролью меняет её: отдельной точки «изменить роль» не нужно. */
export const addShelfMember = async (id: string, username: string, role: ShelfRole) => {
  const { data } = await httpClient.post<ShelfMember[]>(`/shelves/${id}/members`, { username, role });
  return data;
};

export const removeShelfMember = async (id: string, userId: string) => {
  const { data } = await httpClient.delete<ShelfMember[]>(`/shelves/${id}/members/${userId}`);
  return data;
};
