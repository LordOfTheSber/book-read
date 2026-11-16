import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinueShelf } from './ContinueShelf';
import { renderWithStore } from '@/test/renderWithStore';
import { httpClient } from '@/shared/api/httpClient';
import type { LibraryItem } from '@/shared/types/library';

const reading = {
  id: 'b1',
  title: 'Задача трёх тел',
  status: 'READING',
  kind: 'BOOK',
  hasCover: false,
  favorite: false,
  wishlist: false,
  attempt: 1,
  authors: [],
  tags: [],
  shelves: [],
  createdAt: '2026-02-01',
  updatedAt: '2026-02-02',
  progress: { current: 212, total: 400, unit: 'PAGES', percent: 53, remaining: 188, dailyNorm: 24, behindSchedule: false }
} as unknown as LibraryItem;

describe('ContinueShelf', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(httpClient);
    mock.onGet('/items').reply(200, { content: [reading], totalElements: 6, number: 0, size: 6 });
    mock.onPost(/\/items\/.*\/sessions/).reply(200, {});
  });

  afterEach(() => mock.restore());

  it('показывает то, что читается сейчас, и сколько такого всего', async () => {
    renderWithStore(<ContinueShelf onOpen={vi.fn()} onShowAll={vi.fn()} />);

    expect(await screen.findByText('Задача трёх тел')).toBeInTheDocument();
    expect(screen.getByText('212 / 400 стр.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все 6' })).toBeInTheDocument();
  });

  /** Полка просит у сервера только читаемое: остальное на ней не нужно. */
  it('запрашивает записи в статусе «читаю»', async () => {
    renderWithStore(<ContinueShelf onOpen={vi.fn()} onShowAll={vi.fn()} />);

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(mock.history.get[0].params).toMatchObject({ status: 'READING', size: 6 });
  });

  it('«+N» отмечает заход, не открывая карточку', async () => {
    const onOpen = vi.fn();
    renderWithStore(<ContinueShelf onOpen={onOpen} onShowAll={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '+10' }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ fromPosition: 212, toPosition: 222 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('нажатие на карточку открывает запись', async () => {
    const onOpen = vi.fn();
    renderWithStore(<ContinueShelf onOpen={onOpen} onShowAll={vi.fn()} />);

    await userEvent.click(await screen.findByText('Задача трёх тел'));

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
  });

  /** Пустая полка не занимает места: у того, кто ничего не читает, её просто нет. */
  it('без читаемого не показывается вовсе', async () => {
    mock.onGet('/items').reply(200, { content: [], totalElements: 0, number: 0, size: 6 });

    const { container } = renderWithStore(<ContinueShelf onOpen={vi.fn()} onShowAll={vi.fn()} />);

    await waitFor(() => expect(container.querySelector('section')).toBeNull());
  });
});
