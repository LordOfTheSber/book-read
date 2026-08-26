import { httpClient } from '@/shared/api/httpClient';
import { User } from '@/shared/types/library';

export interface AuthRequest {
  username: string;
  password: string;
  /** Запомнить устройство и впредь пускать без пароля. */
  rememberDevice?: boolean;
  /** Отпечаток устройства: без него сервер запоминать отказывается. */
  deviceFingerprint?: string;
}

/** Кого предлагает это устройство до всякого ввода пароля. */
export interface DeviceHint {
  username: string;
  displayName?: string;
  deviceLabel: string;
  lastUsedAt: string;
}

export interface TrustedDevice {
  id: string;
  label: string;
  lastIp?: string;
  lastUsedAt: string;
  expiresAt: string;
  /** Устройство, с которого открыта страница: отключать его — отдельное решение. */
  current: boolean;
}

export interface AuthSession {
  id: string;
  expiresAt: string;
  maxExpiresAt: string;
}

/** Access-токен приходит httpOnly-кукой и в теле ответа отсутствует. */
export interface AuthResponse {
  user: User;
  session?: AuthSession;
  /**
   * Запомнено ли устройство. Просьба могла не исполниться — например, страница открыта без TLS,
   * и отпечаток посчитать нечем, — поэтому «запомнить» подтверждает сервер, а не клиент.
   */
  deviceRemembered?: boolean;
}

export const login = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/login', payload);
  return data;
};

export const register = async (payload: AuthRequest): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/register', payload);
  return data;
};

/** Завершает серверную сессию. Ошибку глушим: локальный выход должен произойти в любом случае. */
export const logout = async (): Promise<void> => {
  await httpClient.post('/auth/logout').catch(() => undefined);
};

/**
 * Кто прописан на этом устройстве. 204 в ответ — устройство неизвестно, и экран входа показывает
 * обычную форму.
 */
export const fetchDeviceHint = async (fingerprint: string): Promise<DeviceHint | undefined> => {
  const { data, status } = await httpClient.get<DeviceHint | ''>('/auth/device', { params: { fingerprint } });
  return status === 204 || !data ? undefined : data;
};

/** Вход без пароля: секрет устройства едет httpOnly-кукой, наружу его никто не показывает. */
export const loginByDevice = async (fingerprint: string): Promise<AuthResponse> => {
  const { data } = await httpClient.post<AuthResponse>('/auth/device/login', { fingerprint });
  return data;
};

/** «Это не я»: устройство перестаёт быть доверенным. Ошибку глушим — кука гаснет в любом случае. */
export const forgetThisDevice = async (): Promise<void> => {
  await httpClient.delete('/auth/device').catch(() => undefined);
};

export const fetchTrustedDevices = async (fingerprint?: string): Promise<TrustedDevice[]> => {
  const { data } = await httpClient.get<TrustedDevice[]>('/account/devices', {
    params: fingerprint ? { fingerprint } : undefined
  });
  return data;
};

export const revokeTrustedDevice = async (id: string, fingerprint?: string): Promise<void> => {
  await httpClient.delete(`/account/devices/${id}`, { params: fingerprint ? { fingerprint } : undefined });
};

export const revokeAllTrustedDevices = async (): Promise<void> => {
  await httpClient.delete('/account/devices');
};

export const fetchMe = async (): Promise<User> => {
  const { data } = await httpClient.get<User>('/users/me');
  return data;
};

export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await httpClient.put<User>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return data;
};
