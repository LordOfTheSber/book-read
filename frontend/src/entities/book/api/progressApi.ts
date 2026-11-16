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

/**
 * Выписки всей библиотеки: с запросом — поиск, без запроса — последние. Пустой запрос не значит
 * «ничего не показывать»: страница выписок открывается стеной, а цитату часто перечитывают,
 * не помня ни книги, ни слова.
 */
export const searchQuotes = async (query?: string) => {
  const { data } = await httpClient.get<Quote[]>('/quotes', { params: query ? { q: query } : undefined });
  return data;
};
