import { httpClient } from '@/shared/api/httpClient';
import { BookAnalytics, ReadingAnalytics } from '@/shared/types/library';

export const fetchBookAnalytics = async (userId?: string): Promise<BookAnalytics> => {
  const { data } = await httpClient.get<BookAnalytics>('/analytics/books', {
    params: userId ? { userId } : undefined
  });
  return data;
};

/**
 * Второй запрос, а не расширение первого: сводку выше берут ещё и список книг с профилем,
 * и держать в ней тепловую карту значило бы платить за неё при каждом открытии библиотеки.
 */
export const fetchReadingAnalytics = async (userId?: string): Promise<ReadingAnalytics> => {
  const { data } = await httpClient.get<ReadingAnalytics>('/analytics/reading', {
    params: userId ? { userId } : undefined
  });
  return data;
};
