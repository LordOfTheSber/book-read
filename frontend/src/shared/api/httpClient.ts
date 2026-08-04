import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAuthToken, getAuthToken, setAuthToken } from './authToken';

/** Access-токен живёт около получаса, поэтому 401 сначала пробуем закрыть обновлением токена. */
interface AuthEventHandlers {
  onTokenRefreshed?: (token: string) => void;
  onSessionExpired?: () => void;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

let authEvents: AuthEventHandlers = {};

export const setAuthEventHandlers = (handlers: AuthEventHandlers): void => {
  authEvents = handlers;
};

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  // Серверная сессия живёт в httpOnly-куке: без неё обновление токена невозможно.
  withCredentials: true
});

httpClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Параллельные запросы, упавшие с 401, ждут один общий запрос обновления. */
let pendingRefresh: Promise<string | undefined> | null = null;

const isAuthEndpoint = (url?: string): boolean => Boolean(url && url.includes('/auth/'));

const refreshAuthToken = (): Promise<string | undefined> => {
  if (!pendingRefresh) {
    pendingRefresh = httpClient
      .post<{ token: string }>('/auth/refresh')
      .then(({ data }) => {
        setAuthToken(data.token);
        authEvents.onTokenRefreshed?.(data.token);
        return data.token;
      })
      .catch(() => undefined)
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
    const token = await refreshAuthToken();

    if (!token) {
      clearAuthToken();
      authEvents.onSessionExpired?.();
      return Promise.reject(error);
    }

    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return httpClient(config);
  }
);
