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
