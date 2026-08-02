import { useCallback } from 'react';
import { App } from 'antd';
import type { AxiosError } from 'axios';

/** Достаёт сообщение из ответа API, иначе — из ошибки, иначе fallback. */
export const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  if (axiosError?.response?.status === 403) {
    return 'Нет прав для выполнения действия';
  }
  return axiosError?.response?.data?.message || (error as Error)?.message || fallback;
};

/** Ошибки валидации формы Ant Design не показываем — их рисует сама форма. */
export const isFormValidationError = (error: unknown) =>
  Boolean((error as { errorFields?: unknown })?.errorFields);

/**
 * Показывает ошибку запроса через message из контекста App, а не через
 * статический antd — статический не видит тему и рисует светлое окно.
 */
export const useRequestError = () => {
  const { message } = App.useApp();

  return useCallback(
    (error: unknown, fallback: string) => {
      if (isFormValidationError(error)) return;
      message.error(getErrorMessage(error, fallback));
    },
    [message]
  );
};
