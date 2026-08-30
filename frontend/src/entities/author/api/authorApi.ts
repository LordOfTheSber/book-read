import { httpClient } from '@/shared/api/httpClient';
import { Author, Showcase } from '@/shared/types/library';

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

/**
 * Обложки для показанных карточек. Идентификаторы перечисляет страница: справочник листается,
 * и грузить обложки всех двухсот авторов ради восемнадцати видимых незачем.
 */
export const fetchAuthorShowcase = async (ids: string[]) => {
  if (ids.length === 0) return {};
  const { data } = await httpClient.get<Showcase>('/authors/showcase', { params: { ids: ids.join(',') } });
  return data;
};

/** Слияние дублей: произведения уходящего автора переходят к остающемуся. */
export const mergeAuthors = async (targetId: string, sourceId: string) => {
  const { data } = await httpClient.post<Author>(`/authors/${targetId}/merge`, { sourceId });
  return data;
};

export const deleteAuthor = async (id: string) => {
  await httpClient.delete(`/authors/${id}`);
};
