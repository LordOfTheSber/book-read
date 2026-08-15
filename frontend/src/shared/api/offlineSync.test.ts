import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { httpClient } from './httpClient';
import { clearQueue, countQueued, enqueue, listQueued } from './offlineQueue';
import { matchQueueable, replayQueue } from './offlineSync';

describe('offlineQueue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('отдаёт записи от старых к новым', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 40 } });

    const queued = await listQueued();

    expect(queued.map((mutation) => mutation.body)).toEqual([
      { progressCurrent: 10 },
      { progressCurrent: 40 }
    ]);
  });

  it('не хранит ничего похожего на учётные данные', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });

    const [queued] = await listQueued();

    expect(Object.keys(queued).sort()).toEqual(['body', 'createdAt', 'method', 'seq', 'url']);
  });
});

describe('matchQueueable', () => {
  it.each([
    // Отдельной точки для прогресса на сервере нет: он, статус, оценка и избранное —
    // поля карточки, и правятся одним PUT.
    ['put', '/items/42'],
    ['post', '/items/42/sessions'],
    ['post', '/items/42/quotes'],
    ['put', '/items/42/quotes/7'],
    // Строка запроса на правило не влияет.
    ['put', '/items/42?force=true']
  ])('откладывает %s %s', (method, url) => {
    expect(matchQueueable(method, url)).toBeDefined();
  });

  /** Создание записи откладывать нельзя: у новой карточки нет идентификатора, под которым её ждут. */
  it.each([
    ['post', '/items'],
    ['delete', '/items/42'],
    ['get', '/items/42'],
    ['post', '/items/42/cover'],
    // Обложка по ссылке — тоже PUT на записи, но путь длиннее и под правило не попадает.
    ['put', '/items/42/cover-from-url']
  ])('не откладывает %s %s', (method, url) => {
    expect(matchQueueable(method, url)).toBeUndefined();
  });
});

describe('replayQueue', () => {
  let mock: MockAdapter;

  beforeEach(async () => {
    await clearQueue();
    mock = new MockAdapter(httpClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('отправляет отложенное и очищает очередь', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    await enqueue({ method: 'post', url: '/items/1/sessions', body: { durationMinutes: 30 } });
    mock.onPut('/items/1').reply(200).onPost('/items/1/sessions').reply(201);

    const result = await replayQueue();

    expect(result).toMatchObject({ sent: 2, dropped: 0, left: 0 });
  });

  it('сохраняет порядок отправки', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 40 } });
    mock.onPut('/items/1').reply(200);

    await replayQueue();

    expect(mock.history.put.map((request) => JSON.parse(request.data))).toEqual([
      { progressCurrent: 10 },
      { progressCurrent: 40 }
    ]);
  });

  /** Сервер правку отверг — повторять её бесконечно хуже, чем потерять один раз. */
  it('выбрасывает записи, отклонённые сервером', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 999 } });
    mock.onPut('/items/1').reply(400);

    const result = await replayQueue();

    expect(result).toMatchObject({ dropped: 1, left: 0 });
  });

  /** Сбой на стороне сервера — не повод терять правку: она дождётся следующей попытки. */
  it('оставляет записи после ошибки сервера и прекращает попытку', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    await enqueue({ method: 'post', url: '/items/1/sessions', body: { durationMinutes: 30 } });
    mock.onPut('/items/1').reply(503).onPost('/items/1/sessions').reply(201);

    const result = await replayQueue();

    expect(result).toMatchObject({ sent: 0, dropped: 0, left: 2 });
    expect(mock.history.post).toHaveLength(0);
  });

  /**
   * Ключевая защита: сорвавшееся проигрывание не должно снова пройти через перехватчик и лечь
   * в очередь вторым экземпляром — иначе каждая попытка удваивала бы её.
   */
  it('не дублирует записи, если сеть пропала во время проигрывания', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    mock.onPut('/items/1').networkError();

    await replayQueue();

    expect(await countQueued()).toBe(1);
  });
});
