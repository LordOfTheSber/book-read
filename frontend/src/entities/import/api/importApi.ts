import { httpClient } from '@/shared/api/httpClient';
import { ImportPreview, ImportResultSummary, ImportRow } from '@/shared/types/library';

export interface ImportCommitPayload {
  rows: ImportRow[];
  tagNames?: string[];
  shelfId?: string;
  duplicateStrategy?: 'SKIP' | 'IMPORT_ANYWAY';
}

/** Разбор ничего не пишет в базу: сначала пользователь смотрит, что получилось. */
export const previewImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await httpClient.post<ImportPreview>('/imports/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const commitImport = async (payload: ImportCommitPayload) => {
  const { data } = await httpClient.post<ImportResultSummary>('/imports/commit', payload);
  return data;
};
