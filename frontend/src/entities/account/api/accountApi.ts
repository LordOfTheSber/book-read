import { httpClient } from '@/shared/api/httpClient';

export type ExportFormat = 'csv' | 'json';

/**
 * Выгрузка своей библиотеки. Отдельная от `/exports`, которая делает административный бэкап всей
 * базы и доступна только супер-администратору.
 */
export const exportMyLibrary = async (format: ExportFormat): Promise<Blob> => {
  const { data } = await httpClient.get('/account/export', {
    params: { format },
    responseType: 'blob'
  });
  return data;
};

/** Пароль подтверждает, что за клавиатурой владелец аккаунта, а не открытая чужая сессия. */
export const deleteMyAccount = async (password: string): Promise<void> => {
  await httpClient.delete('/account', { data: { password } });
};
