import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { countQueued, isQueueAvailable } from '@/shared/api/offlineQueue';
import { replayQueue } from '@/shared/api/offlineSync';
import { setQueueListener } from '@/shared/api/httpClient';

export interface OfflineQueueState {
  online: boolean;
  queued: number;
  /** Ручной повтор: сеть уже есть, а правка застряла на ошибке сервера. */
  retry: () => Promise<void>;
}

/**
 * Состояние связи и очереди отложенных правок.
 *
 * Молчать здесь нельзя не только офлайн: правки остаются в очереди и после возврата сети —
 * если сервер отвечал ошибкой. Человек в этот момент уверен, что прогресс сохранён,
 * а он лежит в браузере.
 */
export const useOfflineQueue = (): OfflineQueueState => {
  const { message } = App.useApp();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queued, setQueued] = useState(0);

  const refresh = useCallback(async () => {
    if (!isQueueAvailable()) return;
    try {
      setQueued(await countQueued());
    } catch {
      // Недоступное хранилище не должно ронять шапку: счётчик просто не обновится.
    }
  }, []);

  const flush = useCallback(async () => {
    if (!isQueueAvailable()) return;
    const result = await replayQueue();
    if (result.sent > 0) {
      message.success(`Отложенные изменения отправлены: ${result.sent}`);
    }
    if (result.dropped > 0) {
      // Сервер отверг правку — повторять её бесконечно хуже, чем сказать об этом один раз.
      message.warning(`Сервер отклонил изменений: ${result.dropped}`);
    }
    setQueued(result.left);
  }, [message]);

  useEffect(() => {
    refresh();
    // Очередь могла остаться с прошлого визита: проигрываем её на старте, а не ждём события.
    if (navigator.onLine) {
      flush();
    }

    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = setQueueListener(() => refresh());

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, [flush, refresh]);

  return { online, queued, retry: flush };
};
