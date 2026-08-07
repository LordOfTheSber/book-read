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

export const deleteTag = async (id: string) => {
  await httpClient.delete(`/tags/${id}`);
};
