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

/**
 * Приём копии со стороны: восстановление после потери сервера начинается с файла, которого
 * на самом сервере как раз и нет. Загруженная копия встаёт в общий список и восстанавливается
 * тем же способом, что и снятая здесь.
 */
export const uploadExport = async (file: File): Promise<ExportFileInfo> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await httpClient.post<ExportFileInfo>('/exports/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const deleteExportFile = async (fileName: string): Promise<void> => {
  await httpClient.delete(`/exports/${fileName}`);
};

export const restoreExport = async (fileName: string): Promise<ImportResult> => {
  const { data } = await httpClient.post<ImportResult>(`/exports/${fileName}/restore`);
  return data;
};
