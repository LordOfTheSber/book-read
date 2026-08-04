import { httpClient } from '@/shared/api/httpClient';
import { LibraryItem, PageResponse } from '@/shared/types/library';

export interface FetchBooksParams {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  typeId?: string;
  status?: string;
  favorite?: boolean;
  minRating?: number;
  maxRating?: number;
  authorId?: string;
  seriesId?: string;
  userId?: string;
}

export const fetchBooks = async (params: FetchBooksParams): Promise<PageResponse<LibraryItem>> => {
  const { data } = await httpClient.get<PageResponse<LibraryItem>>('/items', { params });
  return data;
};

export const createBook = async (payload: Partial<LibraryItem>) => {
  const { data } = await httpClient.post<LibraryItem>('/items', payload);
  return data;
};

export const updateBook = async (id: string, payload: Partial<LibraryItem>) => {
  const { data } = await httpClient.put<LibraryItem>(`/items/${id}`, payload);
  return data;
};

export const deleteBook = async (id: string) => {
  await httpClient.delete(`/items/${id}`);
};

export const uploadCover = async (id: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await httpClient.put<LibraryItem>(`/items/${id}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const deleteCover = async (id: string) => {
  const { data } = await httpClient.delete<LibraryItem>(`/items/${id}/cover`);
  return data;
};

/**
 * Путь к обложке для <img>. Обложка лежит за аутентификацией, поэтому браузер должен послать
 * куки — у относительного адреса того же origin это происходит само.
 */
export const coverUrl = (id: string, updatedAt?: string) => {
  const base = httpClient.defaults.baseURL ?? '/api/v1';
  // Метка версии сбивает кэш браузера после замены обложки.
  return `${base}/items/${id}/cover${updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ''}`;
};
