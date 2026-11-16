import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotesPage } from './QuotesPage';
import { renderWithStore } from '@/test/renderWithStore';
import { Quote } from '@/shared/types/library';

const searchQuotes = vi.fn();

vi.mock('@/entities/book/api/progressApi', () => ({
  searchQuotes: (...args: unknown[]) => searchQuotes(...args),
  deleteQuote: vi.fn(),
  fetchQuotes: vi.fn(),
  addQuote: vi.fn(),
  fetchSessions: vi.fn(),
  addSession: vi.fn(),
  deleteSession: vi.fn(),
  fetchLogs: vi.fn()
}));

const quote = (overrides: Partial<Quote>): Quote => ({
  id: 'q-1',
  itemId: 'i-1',
  itemTitle: 'Задача трёх тел',
  itemAuthorNames: ['Лю Цысинь'],
  text: 'Не отвечайте!',
  createdAt: '2026-08-27T10:00:00Z',
  updatedAt: '2026-08-27T10:00:00Z',
  ...overrides
});

const quotes: Quote[] = [
  quote({ id: 'q-1', position: 118 }),
  quote({ id: 'q-2', position: 64, text: 'Физика не существует' }),
  quote({
    id: 'q-3',
    itemId: 'i-2',
    itemTitle: 'Дюна',
    itemAuthorNames: ['Фрэнк Герберт'],
    position: 214,
    text: 'Страх — убийца разума'
  })
];

describe('QuotesPage', () => {
  beforeEach(() => {
    searchQuotes.mockReset().mockResolvedValue(quotes);
  });

  /**
   * Страница открывалась пустым полем поиска: без запроса не показывалось ничего. Выписки
   * перечитывают просто так, поэтому первый экран — стена, а не приглашение что-то ввести.
   */
  it('показывает выписки стеной без запроса', async () => {
    renderWithStore(<QuotesPage />);

    expect(await screen.findByText(/Не отвечайте!/)).toBeInTheDocument();
    expect(searchQuotes).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('3 выписки из 2 книг')).toBeInTheDocument();
  });

  it('ищет по тексту выписок', async () => {
    renderWithStore(<QuotesPage />);
    await screen.findByText(/Не отвечайте!/);

    await userEvent.type(screen.getByPlaceholderText('Искать по тексту выписок и пометкам'), 'страх');

    await waitFor(() => expect(searchQuotes).toHaveBeenLastCalledWith('страх'));
  });

  /** Второй режим отвечает на другой вопрос: не «где это было», а «что я выписал из этой книги». */
  it('в режиме «По книгам» показывает выписки одной книги по страницам', async () => {
    renderWithStore(<QuotesPage />);
    await screen.findByText(/Не отвечайте!/);

    await userEvent.click(screen.getByText('По книгам'));

    // Первой открывается книга с наибольшим числом выписок.
    expect(await screen.findByRole('heading', { name: 'Задача трёх тел' })).toBeInTheDocument();
    expect(screen.getByText('стр. 64')).toBeInTheDocument();
    expect(screen.queryByText(/Страх — убийца разума/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Дюна/ }));

    expect(await screen.findByText(/Страх — убийца разума/)).toBeInTheDocument();
    expect(screen.queryByText(/Физика не существует/)).not.toBeInTheDocument();
  });

  it('объясняет, где заводятся выписки, когда их нет', async () => {
    searchQuotes.mockResolvedValue([]);
    renderWithStore(<QuotesPage />);

    expect(await screen.findByText(/Выписок пока нет/)).toBeInTheDocument();
  });
});
