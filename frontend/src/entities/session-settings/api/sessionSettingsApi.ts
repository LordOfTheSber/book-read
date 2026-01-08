import { httpClient } from '@/shared/api/httpClient';
import { SessionSettings } from '@/shared/types/library';

export const fetchSessionSettings = async (): Promise<SessionSettings> => {
  const { data } = await httpClient.get<SessionSettings>('/sessions/settings');
  return data;
};

export const updateSessionSettings = async (payload: SessionSettings): Promise<SessionSettings> => {
  const { data } = await httpClient.put<SessionSettings>('/sessions/settings', payload);
  return data;
};
