import '@testing-library/jest-dom/vitest';
// В jsdom нет IndexedDB, а на ней держится очередь отложенных изменений: без подмены её тесты
// проверяли бы только ветку «хранилище недоступно».
import 'fake-indexeddb/auto';

/** Ant Design опрашивает matchMedia через Grid.useBreakpoint, а jsdom его не реализует. */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    }) as unknown as MediaQueryList;
}
