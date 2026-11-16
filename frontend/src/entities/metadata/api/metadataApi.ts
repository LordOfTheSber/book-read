import { httpClient } from '@/shared/api/httpClient';
import { ExternalBook } from '@/shared/types/library';

export interface MetadataSearchParams {
  q?: string;
  isbn?: string;
  provider?: string;
  limit?: number;
}

/** Запрос идёт через наш сервер: у каталогов нет CORS-заголовков, из браузера к ним не достучаться. */
export const searchMetadata = async (params: MetadataSearchParams) => {
  const { data } = await httpClient.get<ExternalBook[]>('/metadata/search', { params });
  return data;
};
