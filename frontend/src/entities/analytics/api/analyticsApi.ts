import { httpClient } from '@/shared/api/httpClient';
import { BookAnalytics } from '@/shared/types/library';

export const fetchBookAnalytics = async (userId?: string): Promise<BookAnalytics> => {
  const { data } = await httpClient.get<BookAnalytics>('/analytics/books', {
    params: userId ? { userId } : undefined
  });
  return data;
};
