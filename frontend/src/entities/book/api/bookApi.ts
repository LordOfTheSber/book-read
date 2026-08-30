import { httpClient } from '@/shared/api/httpClient';
import { BulkUpdateResult, DuplicateCandidate, LibraryItem, PageResponse, ReadingStatus } from '@/shared/types/library';

export interface FetchBooksParams {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  kind?: string;
  typeId?: string;
  status?: string;
  favorite?: boolean;
  minRating?: number;
  maxRating?: number;
  /** Дата завершения, ISO: витрина профиля берёт ими полку года. */
  finishedFrom?: string;
  finishedTo?: string;
  authorId?: string;
  seriesId?: string;
  tagId?: string;
  shelfId?: string;
  wishlist?: boolean;
  userId?: string;
}

export interface BulkUpdatePayload {
  itemIds: string[];
  status?: ReadingStatus;
  favorite?: boolean;
  wishlist?: boolean;
  addTagNames?: string[];
  removeTagIds?: string[];
  typeId?: string;
  addToShelfId?: string;
  removeFromShelfId?: string;
}

export const fetchBooks = async (params: FetchBooksParams): Promise<PageResponse<LibraryItem>> => {
  const { data } = await httpClient.get<PageResponse<LibraryItem>>('/items', { params });
  return data;
};

/** Одна запись по идентификатору: её страница открывается по прямой ссылке и после перезагрузки. */
export const fetchBook = async (id: string) => {
  const { data } = await httpClient.get<LibraryItem>(`/items/${id}`);
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

/** Обложку из каталога забирает сервер: у каталогов нет CORS, из браузера её не скачать. */
export const uploadCoverFromUrl = async (id: string, url: string) => {
  const { data } = await httpClient.put<LibraryItem>(`/items/${id}/cover-from-url`, { url });
  return data;
};

export const bulkUpdateBooks = async (payload: BulkUpdatePayload) => {
  const { data } = await httpClient.post<BulkUpdateResult>('/items/bulk', payload);
  return data;
};

/** Похожие записи в библиотеке: подсказка при вводе, а не запрет на сохранение. */
export const findDuplicates = async (params: { isbn?: string; title?: string }) => {
  const { data } = await httpClient.get<DuplicateCandidate[]>('/items/duplicates', { params });
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
