import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotesTab } from './QuotesTab';
import { LibraryItem, Quote } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const fetchQuotes = vi.fn();
const addQuote = vi.fn();
const deleteQuote = vi.fn();

vi.mock('@/entities/book/api/progressApi', () => ({
  fetchSessions: vi.fn(),
  addSession: vi.fn(),
  deleteSession: vi.fn(),
  fetchLogs: vi.fn(),
  fetchQuotes: (...args: unknown[]) => fetchQuotes(...args),
  addQuote: (...args: unknown[]) => addQuote(...args),
  deleteQuote: (...args: unknown[]) => deleteQuote(...args),
  searchQuotes: vi.fn()
}));

const item = (overrides: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id: 'b-1',
    title: 'Задача трёх тел',
    status: 'READING',
    authors: [],
    hasCover: false,
    kind: 'BOOK',
    ...overrides
  }) as LibraryItem;

const quote = (overrides: Partial<Quote> = {}): Quote =>
  ({
    id: 'q-1',
    itemId: 'b-1',
    itemTitle: 'Задача трёх тел',
    text: 'Не отвечайте!',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides
  }) as Quote;

describe('QuotesTab', () => {
  beforeEach(() => {
    fetchQuotes.mockReset().mockResolvedValue([]);
    addQuote.mockReset().mockResolvedValue(undefined);
    deleteQuote.mockReset().mockResolvedValue(undefined);
  });

  it('отправляет цитату вместе с номером страницы и пометкой', async () => {
    renderWithStore(<QuotesTab item={item()} />);

    await userEvent.type(await screen.findByLabelText('Цитата'), 'Не отвечайте!');
    await userEvent.type(screen.getByLabelText('Номер страницы'), '128');
    await userEvent.type(screen.getByLabelText('Пометка'), 'первый контакт');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() =>
      expect(addQuote).toHaveBeenCalledWith('b-1', {
        text: 'Не отвечайте!',
        position: 128,
        note: 'первый контакт'
      })
    );
  });

  it('не отправляет пустую цитату', async () => {
    renderWithStore(<QuotesTab item={item()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Текст обязателен')).toBeInTheDocument();
    expect(addQuote).not.toHaveBeenCalled();
  });

  /** У сериала цитату привязывают к эпизоду, а не к странице: подпись идёт от вида произведения. */
  it('называет позицию по виду произведения', async () => {
    renderWithStore(<QuotesTab item={item({ kind: 'SERIES' })} />);

    expect(await screen.findByLabelText('Номер эпизода')).toBeInTheDocument();
  });

  it('перечитывает список после удаления выписки', async () => {
    fetchQuotes.mockResolvedValue([quote({ position: 128, note: 'первый контакт' })]);

    renderWithStore(<QuotesTab item={item()} />);

    // Цитата набирается в кавычках-ёлочках, как в макете, поэтому ищется подстрокой.
    expect(await screen.findByText(/Не отвечайте!/)).toBeInTheDocument();
    expect(screen.getByText('первый контакт')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Удалить выписку'));

    await waitFor(() => expect(deleteQuote).toHaveBeenCalledWith('b-1', 'q-1'));
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });
});
