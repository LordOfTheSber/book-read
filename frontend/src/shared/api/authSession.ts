/**
 * Access-токен живёт в httpOnly-куке и приложению недоступен. Чтобы после перезагрузки страницы
 * не мигать экраном входа до ответа `/users/me`, храним только несекретный признак «вход выполнен»:
 * подделка флага ничего не даёт, любой запрос всё равно проверяется на сервере.
 */
const SESSION_FLAG_KEY = 'authSessionActive';

/**
 * Отметка «человек только что вышел сам». Без неё быстрый вход по доверенному устройству
 * срабатывал бы сразу после нажатия «выйти» и возвращал бы туда, откуда человек уходил, —
 * выйти было бы невозможно. Живёт во вкладке: в новой вкладке или после перезапуска браузера
 * устройство снова узнаёт своего владельца.
 */
const QUICK_LOGIN_SUPPRESSED_KEY = 'authQuickLoginSuppressed';

export const isAuthSessionActive = (): boolean => localStorage.getItem(SESSION_FLAG_KEY) === '1';

export const markAuthSessionActive = (): void => localStorage.setItem(SESSION_FLAG_KEY, '1');

export const clearAuthSession = (): void => localStorage.removeItem(SESSION_FLAG_KEY);

/** Хранилище вкладки может быть закрыто настройками браузера: отсутствие отметки не ошибка. */
const sessionFlag = {
  read: (): string | null => {
    try {
      return sessionStorage.getItem(QUICK_LOGIN_SUPPRESSED_KEY);
    } catch {
      return null;
    }
  },
  write: (value: string | null): void => {
    try {
      if (value === null) {
        sessionStorage.removeItem(QUICK_LOGIN_SUPPRESSED_KEY);
      } else {
        sessionStorage.setItem(QUICK_LOGIN_SUPPRESSED_KEY, value);
      }
    } catch {
      // Без отметки быстрый вход просто сработает снова — это не повод ронять выход.
    }
  }
};

export const isQuickLoginSuppressed = (): boolean => sessionFlag.read() === '1';

/** Вызывается при выходе: следующий экран входа не станет входить сам. */
export const suppressQuickLogin = (): void => sessionFlag.write('1');

export const allowQuickLogin = (): void => sessionFlag.write(null);
