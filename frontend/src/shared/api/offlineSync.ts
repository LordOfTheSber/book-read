import { AxiosError } from 'axios';
import { httpClient } from './httpClient';
import { QueuedMethod, QueuedMutation, countQueued, listQueued, removeQueued } from './offlineQueue';

/**
 * Что можно отложить. Список короткий намеренно: сюда попало только то, что человек правит
 * на ходу — прогресс, заход чтения, статус или оценка в карточке, выписка. Всё это правки
 * существующих записей с известным идентификатором, поэтому проигрывание не требует ни локальных
 * идентификаторов, ни разрешения конфликтов.
 *
 * Создание записей и загрузка файлов сюда не входят: у новой карточки нет идентификатора, а
 * multipart пришлось бы хранить целиком в IndexedDB, и сценарий «загружаю обложку в метро»
 * этого не стоит.
 */
const QUEUEABLE: Array<{ method: QueuedMethod; pattern: RegExp; entity: string }> = [
  // Прогресс, статус, оценка и избранное правятся одним запросом — отдельной точки для прогресса
  // на сервере нет, всё это поля карточки.
  { method: 'put', pattern: /^\/items\/[^/]+$/, entity: 'Карточка' },
  { method: 'post', pattern: /^\/items\/[^/]+\/sessions$/, entity: 'Заход чтения' },
  { method: 'post', pattern: /^\/items\/[^/]+\/quotes$/, entity: 'Выписка' },
  { method: 'put', pattern: /^\/items\/[^/]+\/quotes\/[^/]+$/, entity: 'Выписка' }
];

export const matchQueueable = (method?: string, url?: string) => {
  if (!method || !url) return undefined;
  const normalized = method.toLowerCase() as QueuedMethod;
  // Строка запроса на правило не влияет: очередь смотрит на путь.
  const path = url.split('?')[0];
  return QUEUEABLE.find((rule) => rule.method === normalized && rule.pattern.test(path));
};

/** Сетевой сбой — это отсутствующий ответ; 500 от живого сервера в очередь не попадает. */
export const isNetworkError = (error: AxiosError): boolean =>
  error.response === undefined && error.code !== 'ERR_CANCELED';

export interface ReplayResult {
  sent: number;
  dropped: number;
  left: number;
}

/**
 * Проигрывание очереди — последовательно и от старых к новым: две правки одного прогресса подряд
 * должны лечь в исходном порядке, а параллельная отправка этого не гарантирует.
 *
 * 4xx означает, что сервер правку отверг: повторять её бесконечно хуже, чем потерять, — запись
 * выбрасывается. 5xx и сетевая ошибка оставляют очередь как есть и прекращают попытку: если сеть
 * снова пропала, остальные записи всё равно не уйдут.
 */
export const replayQueue = async (): Promise<ReplayResult> => {
  const pending = await listQueued();
  let sent = 0;
  let dropped = 0;

  for (const mutation of pending) {
    try {
      await send(mutation);
      await removeQueued(mutation.seq);
      sent += 1;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status !== undefined && status >= 400 && status < 500) {
        await removeQueued(mutation.seq);
        dropped += 1;
        continue;
      }
      break;
    }
  }

  return { sent, dropped, left: await countQueued() };
};

/**
 * Пометка `replayedFromQueue` обязательна: без неё сорвавшееся проигрывание снова прошло бы через
 * перехватчик и легло в очередь вторым экземпляром — и так на каждой попытке.
 */
const send = (mutation: QueuedMutation) =>
  httpClient.request({
    method: mutation.method,
    url: mutation.url,
    data: mutation.body,
    replayedFromQueue: true
  } as never);
