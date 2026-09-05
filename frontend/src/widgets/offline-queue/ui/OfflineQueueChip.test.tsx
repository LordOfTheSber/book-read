import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineQueueChip } from './OfflineQueueChip';
import { renderWithStore } from '@/test/renderWithStore';
import { httpClient } from '@/shared/api/httpClient';
import { clearQueue, countQueued, enqueue } from '@/shared/api/offlineQueue';

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });

describe('OfflineQueueChip', () => {
  let mock: MockAdapter;

  beforeEach(async () => {
    await clearQueue();
    mock = new MockAdapter(httpClient);
    setOnline(true);
  });

  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  it('молчит, когда есть сеть и очередь пуста', async () => {
    const { container } = renderWithStore(<OfflineQueueChip />);

    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('без сети сообщает об этом, даже когда отправлять нечего', async () => {
    setOnline(false);
    renderWithStore(<OfflineQueueChip />);

    expect(await screen.findByText('Нет сети')).toBeInTheDocument();
  });

  it('без сети показывает, сколько правок ждёт отправки', async () => {
    setOnline(false);
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    await enqueue({ method: 'put', url: '/items/2', body: { progressCurrent: 20 } });

    renderWithStore(<OfflineQueueChip />);

    expect(await screen.findByText('2 правки ждут сети')).toBeInTheDocument();
  });

  /** Очередь могла остаться с прошлого визита — её проигрывают на старте, а не ждут события. */
  it('проигрывает оставшуюся очередь при монтировании', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    mock.onPut('/items/1').reply(200);

    renderWithStore(<OfflineQueueChip />);

    await waitFor(async () => expect(await countQueued()).toBe(0));
    expect(mock.history.put).toHaveLength(1);
  });

  /** Сеть вернулась, а правка не ушла: молчать здесь нельзя — человек уверен, что всё сохранено. */
  it('при живой сети показывает застрявшие правки', async () => {
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    mock.onPut('/items/1').reply(503);

    renderWithStore(<OfflineQueueChip />);

    expect(await screen.findByText('1 правка не ушла')).toBeInTheDocument();
  });

  it('отправляет очередь по возвращении сети', async () => {
    setOnline(false);
    await enqueue({ method: 'put', url: '/items/1', body: { progressCurrent: 10 } });
    mock.onPut('/items/1').reply(200);
    renderWithStore(<OfflineQueueChip />);
    await screen.findByText('1 правка ждёт сети');

    setOnline(true);
    window.dispatchEvent(new Event('online'));

    await waitFor(async () => expect(await countQueued()).toBe(0));
  });
});
