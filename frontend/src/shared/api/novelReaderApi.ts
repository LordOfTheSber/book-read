import { httpClient } from './httpClient';
import { NovelChapter } from '@/shared/types/library';

export const parseNovelChapter = async (url: string): Promise<NovelChapter> => {
  const { data } = await httpClient.get<NovelChapter>('/novel-reader/parse', {
    params: { url }
  });
  return data;
};
