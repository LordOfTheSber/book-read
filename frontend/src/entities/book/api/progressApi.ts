import { httpClient } from '@/shared/api/httpClient';
import { Quote, ReadingLog, ReadingSession } from '@/shared/types/library';

export interface ReadingSessionPayload {
  sessionDate?: string;
  fromPosition?: number;
  toPosition?: number;
  durationMinutes?: number;
  note?: string;
}

export const fetchSessions = async (itemId: string) => {
  const { data } = await httpClient.get<ReadingSession[]>(`/items/${itemId}/sessions`);
  return data;
};

export const addSession = async (itemId: string, payload: ReadingSessionPayload) => {
  const { data } = await httpClient.post<ReadingSession>(`/items/${itemId}/sessions`, payload);
  return data;
};

export const deleteSession = async (itemId: string, sessionId: string) => {
  await httpClient.delete(`/items/${itemId}/sessions/${sessionId}`);
};

export const fetchLogs = async (itemId: string) => {
  const { data } = await httpClient.get<ReadingLog[]>(`/items/${itemId}/logs`);
  return data;
};

export const fetchQuotes = async (itemId: string) => {
  const { data } = await httpClient.get<Quote[]>(`/items/${itemId}/quotes`);
  return data;
};

export interface QuotePayload {
  position?: number;
  text: string;
  note?: string;
}

export const addQuote = async (itemId: string, payload: QuotePayload) => {
  const { data } = await httpClient.post<Quote>(`/items/${itemId}/quotes`, payload);
  return data;
};

export const deleteQuote = async (itemId: string, quoteId: string) => {
  await httpClient.delete(`/items/${itemId}/quotes/${quoteId}`);
};

/** Поиск по выпискам всей библиотеки: цитату часто помнят, а книгу — нет. */
export const searchQuotes = async (query: string) => {
  const { data } = await httpClient.get<Quote[]>('/quotes', { params: { q: query } });
  return data;
};
