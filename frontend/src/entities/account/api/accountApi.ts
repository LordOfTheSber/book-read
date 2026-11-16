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

/**
 * Смена собственного пароля. Сервер вместе с ним гасит все сессии и запомненные устройства:
 * пароль меняют, когда старый мог утечь.
 */
export const changeMyPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await httpClient.put('/account/password', { currentPassword, newPassword });
};

/** Пароль подтверждает, что за клавиатурой владелец аккаунта, а не открытая чужая сессия. */
export const deleteMyAccount = async (password: string): Promise<void> => {
  await httpClient.delete('/account', { data: { password } });
};
