const TOKEN_KEY = 'authToken';

export const getAuthToken = (): string | undefined => localStorage.getItem(TOKEN_KEY) ?? undefined;

export const setAuthToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);

export const clearAuthToken = (): void => localStorage.removeItem(TOKEN_KEY);
