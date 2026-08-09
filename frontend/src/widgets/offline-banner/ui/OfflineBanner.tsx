import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App } from 'antd';
import { CloudSyncOutlined, DisconnectOutlined } from '@ant-design/icons';
import { countQueued, isQueueAvailable } from '@/shared/api/offlineQueue';
import { replayQueue } from '@/shared/api/offlineSync';
import { setQueueListener } from '@/shared/api/httpClient';
import { pluralize } from '@/shared/lib/plural';

/**
 * Состояние связи и очереди отложенных правок.
 *
 * Показывается не только офлайн: правки могут остаться в очереди и после возврата сети — если
 * сервер отвечал ошибкой. Молчащий интерфейс в этот момент хуже всего: человек уверен, что
 * прогресс сохранён, а он лежит в браузере.
 */
export const OfflineBanner: React.FC = () => {
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

  if (online && queued === 0) {
    return null;
  }

  const pending = queued > 0 ? pluralize(queued, ['изменение', 'изменения', 'изменений']) : null;

  return (
    <Alert
      banner
      type={online ? 'info' : 'warning'}
      icon={online ? <CloudSyncOutlined /> : <DisconnectOutlined />}
      showIcon
      message={
        online
          ? `Не отправлено: ${pending}. Повторим автоматически.`
          : pending
            ? `Нет сети. Изменения сохраняются локально: ${pending}.`
            : 'Нет сети. Показаны последние загруженные данные.'
      }
    />
  );
};
