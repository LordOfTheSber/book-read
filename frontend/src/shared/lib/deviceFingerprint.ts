/**
 * Отпечаток устройства для быстрого входа.
 *
 * Браузер не выдаёт ничего, что однозначно опознавало бы машину: серийного номера, MAC-адреса и
 * прочего «железа» на странице нет и не будет. Поэтому отпечаток здесь — не пропуск, а
 * подтверждение к httpOnly-куке с секретом: сервер пускает без пароля, только если совпали оба,
 * а подделать куку из JavaScript нельзя.
 *
 * Признаки подобраны так, чтобы не меняться от обновления браузера: версия в User-Agent растёт
 * каждый месяц, а разрешение окна — при подключении второго монитора, и любой из них ломал бы
 * быстрый вход на ровном месте. Остаются свойства машины (ядра, память, глубина цвета, тип
 * ввода), язык, часовой пояс и метка, положенная в `localStorage` при первом заходе: она же
 * разводит два браузера на одном компьютере — это разные устройства и есть.
 */
const DEVICE_ID_KEY = 'deviceId';

/** Метка живёт в `localStorage`: её чистка равносильна «это другое устройство». */
const readDeviceId = (): string => {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }
    const generated =
      typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Math.random()).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    // Приватный режим или запрет на хранилище: отпечаток соберётся из одних свойств машины.
    return '';
  }
};

const collectSignals = (): string[] => {
  const hardware = navigator as Navigator & { deviceMemory?: number };
  return [
    readDeviceId(),
    navigator.platform ?? '',
    navigator.language ?? '',
    String(hardware.hardwareConcurrency ?? ''),
    String(hardware.deviceMemory ?? ''),
    String(window.screen?.colorDepth ?? ''),
    String(navigator.maxTouchPoints ?? ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  ];
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

let pending: Promise<string | undefined> | null = null;

/**
 * Отпечаток текущего устройства или `undefined`, если посчитать его нечем.
 *
 * `crypto.subtle` есть только в защищённом контексте: страница, открытая по http на сетевом
 * адресе, останется без быстрого входа — и это правильно, секрет устройства и без того нельзя
 * пускать по открытому каналу.
 */
export const getDeviceFingerprint = (): Promise<string | undefined> => {
  if (!pending) {
    pending = (async () => {
      if (!crypto?.subtle) {
        return undefined;
      }
      try {
        const source = new TextEncoder().encode(collectSignals().join('|'));
        return toHex(await crypto.subtle.digest('SHA-256', source));
      } catch {
        return undefined;
      }
    })();
  }
  return pending;
};

/** Сброс памяти модуля между тестами: в жизни отпечаток за сеанс не меняется. */
export const resetDeviceFingerprintCache = (): void => {
  pending = null;
};
