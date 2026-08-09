/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

/**
 * Список файлов сборки подставляет vite-plugin-pwa: имена там хешированные, и собрать его руками
 * нельзя — ради этого плагин и нужен, стратегии ниже написаны сами.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/*
 * Роутер приложения — createBrowserRouter, то есть настоящие пути в History API. Без этого правила
 * офлайн работал бы только на корне: /books и /goals ушли бы в сеть за собственным документом,
 * которого на сервере нет.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api\//]
}));

/*
 * Обложки. CacheFirst безопасен: адрес обложки уже содержит ?v=updatedAt, и после замены картинки
 * ссылка меняется — протухшая версия из кеша не всплывёт.
 */
registerRoute(
  ({ url }) => /\/api\/v1\/items\/[^/]+\/cover/.test(url.pathname),
  new CacheFirst({
    cacheName: 'covers',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })
    ]
  })
);

/*
 * Данные библиотеки. NetworkFirst с коротким таймаутом: в сети отдаём свежее, без сети — последнее
 * виденное. Три секунды выбраны как граница, за которой ожидание уже заметно, а не как оценка
 * скорости бэкенда.
 *
 * `/auth/` исключён нарочно: складывать в кеш ответы про сессию нельзя ни при каких условиях —
 * тем более что этот worker вообще не умеет обновлять истёкший токен.
 */
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/v1/') && !url.pathname.includes('/auth/'),
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 })
    ]
  })
);

/** registerType: 'autoUpdate' присылает это сообщение сам — новый worker не должен ждать закрытия вкладок. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
