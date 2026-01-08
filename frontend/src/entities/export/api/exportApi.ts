import { httpClient } from '@/shared/api/httpClient';
import { ExportFileInfo, ExportInfo, ImportResult } from '@/shared/types/library';

export const requestExport = async (): Promise<ExportInfo> => {
  const { data } = await httpClient.post<ExportInfo>('/exports');
  return data;
};

export const downloadExport = async (fileName: string): Promise<Blob> => {
  const { data } = await httpClient.get(`/exports/${fileName}`, { responseType: 'blob' });
  return data;
};

export const listExports = async (): Promise<ExportFileInfo[]> => {
  const { data } = await httpClient.get<ExportFileInfo[]>('/exports');
  return data;
};

export const deleteExportFile = async (fileName: string): Promise<void> => {
  await httpClient.delete(`/exports/${fileName}`);
};

export const restoreExport = async (fileName: string): Promise<ImportResult> => {
  const { data } = await httpClient.post<ImportResult>(`/exports/${fileName}/restore`);
  return data;
};
