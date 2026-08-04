import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAuthSession } from './authSession';

/** Access-токен живёт около получаса, поэтому 401 сначала пробуем закрыть обновлением токена. */
interface AuthEventHandlers {
  onSessionExpired?: () => void;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

let authEvents: AuthEventHandlers = {};

export const setAuthEventHandlers = (handlers: AuthEventHandlers): void => {
  authEvents = handlers;
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

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;

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
