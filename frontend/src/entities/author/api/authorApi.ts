import { httpClient } from '@/shared/api/httpClient';
import { Author } from '@/shared/types/library';

export const fetchAuthors = async (query?: string) => {
  const { data } = await httpClient.get<Author[]>('/authors', { params: query ? { q: query } : undefined });
  return data;
};

export const createAuthor = async (payload: Partial<Author>) => {
  const { data } = await httpClient.post<Author>('/authors', payload);
  return data;
};

export const updateAuthor = async (id: string, payload: Partial<Author>) => {
  const { data } = await httpClient.put<Author>(`/authors/${id}`, payload);
  return data;
};

export const deleteAuthor = async (id: string) => {
  await httpClient.delete(`/authors/${id}`);
};
