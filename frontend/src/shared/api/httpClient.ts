import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { clearAuthSession } from './authSession';
import { enqueue, isQueueAvailable } from './offlineQueue';
import { isNetworkError, matchQueueable } from './offlineSync';

/** Access-токен живёт около получаса, поэтому 401 сначала пробуем закрыть обновлением токена. */
interface AuthEventHandlers {
  onSessionExpired?: () => void;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  retriedAfterRefresh?: boolean;
  /**
   * Запрос уже проигрывается из очереди. Без этой пометки сорвавшееся проигрывание попало бы
   * в очередь второй раз — и так на каждой попытке.
   */
  replayedFromQueue?: boolean;
};

let authEvents: AuthEventHandlers = {};

export const setAuthEventHandlers = (handlers: AuthEventHandlers): void => {
  authEvents = handlers;
};

/**
 * Подписка на пополнение очереди. Отдельно от {@link setAuthEventHandlers}, потому что слушатель
 * здесь — компонент: он монтируется и размонтируется, и заменять им общий набор обработчиков
 * значило бы затирать обработку истёкшей сессии.
 */
let queueListener: (() => void) | null = null;

export const setQueueListener = (listener: () => void): (() => void) => {
  queueListener = listener;
  return () => {
    if (queueListener === listener) {
      queueListener = null;
    }
  };
};

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  // И серверная сессия, и access-токен живут в httpOnly-куках: прикреплять их вручную нечем.
  withCredentials: true
});

/** Параллельные запросы, упавшие с 401, ждут один общий запрос обновления. */
let pendingRefresh: Promise<boolean> | null = null;

const isAuthEndpoint = (url?: string): boolean => Boolean(url && url.includes('/auth/'));

/** Новый токен приходит кукой, поэтому наружу отдаётся только факт успеха. */
const refreshAuthToken = (): Promise<boolean> => {
  if (!pendingRefresh) {
    pendingRefresh = httpClient
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        pendingRefresh = null;
      });
  }

  return pendingRefresh;
};

/**
 * Ответ на отложенную правку. Настоящего ответа сервера у нас нет и быть не может, поэтому
 * отдаётся 202: вызывающий код видит успех и не откатывает своё оптимистичное состояние, а те,
 * кому важна разница, отличают её по статусу.
 */
const acceptedOffline = (config: InternalAxiosRequestConfig): AxiosResponse => ({
  data: null,
  status: 202,
  statusText: 'Accepted (offline)',
  headers: {},
  config
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;

    if (config && !config.replayedFromQueue && isNetworkError(error)) {
      const queueable = isQueueAvailable() ? matchQueueable(config.method, config.url) : undefined;
      // FormData в очередь не кладём: хранить файл в IndexedDB и проигрывать его — заметно
      // другая задача, и правило в offlineSync это уже отражает, но проверка тут дешевле веры.
      if (queueable && !(config.data instanceof FormData)) {
        await enqueue({
          method: queueable.method,
          url: config.url!,
          body: parseBody(config.data),
          entity: queueable.entity
        });
        queueListener?.();
        return acceptedOffline(config);
      }
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || !config || config.retriedAfterRefresh || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }

    config.retriedAfterRefresh = true;

    if (!(await refreshAuthToken())) {
      clearAuthSession();
      authEvents.onSessionExpired?.();
      return Promise.reject(error);
    }

    return httpClient(config);
  }
);

/** Axios успевает сериализовать тело до перехватчика; в хранилище кладём разобранный объект. */
const parseBody = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};
