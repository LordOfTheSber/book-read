import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient, setQueueListener } from './httpClient';
import { clearQueue, listQueued } from './offlineQueue';

describe('httpClient и офлайн-очередь', () => {
  let mock: MockAdapter;

  beforeEach(async () => {
    await clearQueue();
    mock = new MockAdapter(httpClient);
  });

  afterEach(() => {
    mock.restore();
  });

  /**
   * Правка прогресса без сети не должна пропадать: вызывающий код видит успех, а изменение ждёт
   * в очереди. Иначе человек, отметивший страницу в метро, теряет её молча.
   */
  it('кладёт правку прогресса в очередь и отвечает успехом', async () => {
    mock.onPut('/items/1').networkError();

    const response = await httpClient.put('/items/1', { progressCurrent: 120 });

    expect(response.status).toBe(202);
    expect(await listQueued()).toMatchObject([
      { method: 'put', url: '/items/1', body: { progressCurrent: 120 } }
    ]);
  });

  it('сообщает подписчику о пополнении очереди', async () => {
    const listener = vi.fn();
    const unsubscribe = setQueueListener(listener);
    mock.onPost('/items/1/sessions').networkError();

    await httpClient.post('/items/1/sessions', { durationMinutes: 30 });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  /** Ошибка сервера — это ответ, а не потеря связи: такую правку откладывать нельзя. */
  it('не откладывает отказ сервера', async () => {
    mock.onPut('/items/1').reply(422);

    await expect(httpClient.put('/items/1', { progressCurrent: 120 })).rejects.toThrow();
    expect(await listQueued()).toHaveLength(0);
  });

  /** Создание записи не откладывается: у новой карточки нет идентификатора, под которым её ждут. */
  it('не откладывает создание записи', async () => {
    mock.onPost('/items').networkError();

    await expect(httpClient.post('/items', { title: 'Дюна' })).rejects.toThrow();
    expect(await listQueued()).toHaveLength(0);
  });

  /** Файлы в IndexedDB не кладём — это заметно другая задача, чем несколько полей формы. */
  it('не откладывает загрузку обложки', async () => {
    mock.onPut('/items/1').networkError();
    const form = new FormData();
    form.append('file', new Blob(['cover']));

    await expect(httpClient.put('/items/1', form)).rejects.toThrow();
    expect(await listQueued()).toHaveLength(0);
  });

  /** В очередь ложатся адрес и тело — и ничего, что напоминало бы учётные данные. */
  it('не сохраняет заголовки и куки запроса', async () => {
    mock.onPut('/items/1').networkError();

    await httpClient.put('/items/1', { progressCurrent: 5 }, { headers: { 'X-Secret': 'token' } });

    const serialized = JSON.stringify(await listQueued());
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('X-Secret');
  });
});
