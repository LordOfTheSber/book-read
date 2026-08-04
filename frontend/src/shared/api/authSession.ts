/**
 * Access-токен живёт в httpOnly-куке и приложению недоступен. Чтобы после перезагрузки страницы
 * не мигать экраном входа до ответа `/users/me`, храним только несекретный признак «вход выполнен»:
 * подделка флага ничего не даёт, любой запрос всё равно проверяется на сервере.
 */
const SESSION_FLAG_KEY = 'authSessionActive';

export const isAuthSessionActive = (): boolean => localStorage.getItem(SESSION_FLAG_KEY) === '1';

export const markAuthSessionActive = (): void => localStorage.setItem(SESSION_FLAG_KEY, '1');

export const clearAuthSession = (): void => localStorage.removeItem(SESSION_FLAG_KEY);
