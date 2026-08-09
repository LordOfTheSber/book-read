import { registerSW } from 'virtual:pwa-register';

/**
 * Регистрация service worker. Вынесена из main.tsx отдельным модулем, потому что в деве worker
 * выключен и виртуальный модуль там пустой: держать этот импорт рядом с деревом React значило бы
 * смешивать сборочную деталь с точкой входа приложения.
 *
 * Тихое обновление: `autoUpdate` ставит новую версию сам, а перезагрузку мы не навязываем —
 * человек, читающий карточку книги, не должен терять её из-за выкатки.
 */
export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  registerSW({ immediate: true });
};
