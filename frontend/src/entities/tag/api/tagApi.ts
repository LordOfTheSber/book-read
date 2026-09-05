import { httpClient } from '@/shared/api/httpClient';
import { Tag } from '@/shared/types/library';

export interface TagPayload {
  name: string;
  color?: string;
}

export const fetchTags = async () => {
  const { data } = await httpClient.get<Tag[]>('/tags');
  return data;
};

export const createTag = async (payload: TagPayload) => {
  const { data } = await httpClient.post<Tag>('/tags', payload);
  return data;
};

export const updateTag = async (id: string, payload: TagPayload) => {
  const { data } = await httpClient.put<Tag>(`/tags/${id}`, payload);
  return data;
};

/** Объединение дублей: пометки уходящего тега переезжают на остающийся. */
export const mergeTags = async (targetId: string, sourceId: string) => {
  const { data } = await httpClient.post<Tag>(`/tags/${targetId}/merge`, { sourceId });
  return data;
};

export const deleteTag = async (id: string) => {
  await httpClient.delete(`/tags/${id}`);
};
