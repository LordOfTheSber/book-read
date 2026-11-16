import { httpClient } from '@/shared/api/httpClient';
import { BookType } from '@/shared/types/library';

export const fetchBookTypes = async () => {
  const { data } = await httpClient.get<BookType[]>('/types');
  return data;
};

export const createBookType = async (payload: Partial<BookType>) => {
  const { data } = await httpClient.post<BookType>('/types', payload);
  return data;
};

export const updateBookType = async (id: string, payload: Partial<BookType>) => {
  const { data } = await httpClient.put<BookType>(`/types/${id}`, payload);
  return data;
};

export const deleteBookType = async (id: string) => {
  await httpClient.delete(`/types/${id}`);
};
