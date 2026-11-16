/**
 * Очередь изменений, не доехавших до сервера.
 *
 * Живёт на странице, а не в service worker, и это не случайность. Аутентификация держится на
 * httpOnly-куках, access-токен живёт около получаса и продлевается перехватчиком httpClient.
 * Внутри worker этого перехватчика нет: отложенный запрос, проигранный через Background Sync,
 * упёрся бы в 401 и умер молча — то есть ровно там, где пользователь уверен, что его правка
 * сохранилась.
 *
 * В хранилище кладутся только метод, адрес и тело. Никаких учётных данных: куки остаются
 * httpOnly, и в IndexedDB им делать нечего.
 */

const DB_NAME = 'library-tracker-offline';
const DB_VERSION = 1;
const STORE = 'pending-mutations';

export type QueuedMethod = 'post' | 'put' | 'patch' | 'delete';

export interface QueuedMutation {
  /**
   * Порядковый номер, который выдаёт само хранилище. Не отметка времени: две правки одной
   * карточки подряд укладываются в одну миллисекунду, и сортировка по часам их путает — а порядок
   * здесь и есть смысл очереди.
   */
  seq: number;
  method: QueuedMethod;
  url: string;
  body?: unknown;
  createdAt: number;
  /** Что правилось — только для подписи в интерфейсе, на проигрывание не влияет. */
  entity?: string;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

/** Приложение может открываться и там, где IndexedDB нет (приватный режим старых браузеров). */
export const isQueueAvailable = (): boolean => typeof indexedDB !== 'undefined';

export const enqueue = async (
  mutation: Omit<QueuedMutation, 'seq' | 'createdAt'>
): Promise<number> => {
  const key = await withStore<IDBValidKey>('readwrite', (store) =>
    store.add({ ...mutation, createdAt: Date.now() })
  );
  return key as number;
};

/**
 * Старые записи идут первыми. Сортировать не нужно: IndexedDB отдаёт `getAll` в порядке ключа,
 * а ключ здесь — возрастающий номер, выданный при вставке.
 */
export const listQueued = async (): Promise<QueuedMutation[]> =>
  withStore<QueuedMutation[]>('readonly', (store) => store.getAll());

export const removeQueued = async (seq: number): Promise<void> => {
  await withStore('readwrite', (store) => store.delete(seq));
};

export const countQueued = async (): Promise<number> =>
  withStore<number>('readonly', (store) => store.count());

export const clearQueue = async (): Promise<void> => {
  await withStore('readwrite', (store) => store.clear());
};
