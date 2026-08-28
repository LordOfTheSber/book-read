import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogPage } from './CatalogPage';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { Author, BookType } from '@/shared/types/library';

const fetchAuthors = vi.fn();
const mergeAuthors = vi.fn();
const updateBookType = vi.fn();
const fetchBooks = vi.fn();

vi.mock('@/entities/author/api/authorApi', () => ({
  fetchAuthors: (...args: unknown[]) => fetchAuthors(...args),
  createAuthor: vi.fn(),
  updateAuthor: vi.fn(),
  mergeAuthors: (...args: unknown[]) => mergeAuthors(...args),
  deleteAuthor: vi.fn()
}));

vi.mock('@/entities/series/api/seriesApi', () => ({
  fetchSeries: vi.fn().mockResolvedValue([]),
  createSeries: vi.fn(),
  updateSeries: vi.fn(),
  deleteSeries: vi.fn()
}));

vi.mock('@/entities/book-type/api/bookTypeApi', () => ({
  fetchBookTypes: vi
    .fn()
    .mockResolvedValue([
      { id: 't-1', name: 'Нон-фикшн', createdAt: '2026-01-01', updatedAt: '2026-01-01' } as BookType
    ]),
  createBookType: vi.fn(),
  updateBookType: (...args: unknown[]) => updateBookType(...args),
  deleteBookType: vi.fn()
}));

vi.mock('@/entities/source/api/sourceApi', () => ({
  fetchSources: vi.fn().mockResolvedValue([]),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn()
}));

vi.mock('@/entities/analytics/api/analyticsApi', () => ({
  fetchBookAnalytics: vi.fn().mockResolvedValue({
    totalItems: 8,
    favoriteItems: 0,
    statusBreakdown: {},
    topTypes: [{ typeId: 't-1', typeName: 'Нон-фикшн', count: 4 }],
    topSources: []
  })
}));

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: (...args: unknown[]) => fetchBooks(...args),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

const author = (overrides: Partial<Author>): Author => ({
  id: 'a-1',
  name: 'Лю Цысинь',
  itemCount: 6,
  finishedCount: 5,
  averageRating: 9.2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
});

/** Правка справочника — право редактора: под пользователем без роли кнопок бы не было. */
const adminStore = () =>
  createTestStore({
    auth: {
      authenticated: true,
      user: { id: 'u-1', username: 'sber', role: 'ADMIN', blocked: false },
      loadingUser: false,
      updatingAvatar: false
    }
  });

const renderPage = () => renderWithStore(<CatalogPage />, adminStore(), { route: '/catalog' });

/**
 * jsdom всегда отвечает `matches: false`, поэтому Ant Design считает экран узким и переключатель
 * справочников рисуется сегментами, а не рельсом.
 */
const switchTo = (label: string) =>
  screen.getByRole('radio', { name: label }).closest('label') as HTMLElement;

describe('CatalogPage', () => {
  beforeEach(() => {
    fetchAuthors.mockReset().mockResolvedValue([author({})]);
    mergeAuthors.mockReset().mockResolvedValue(author({ altName: 'Cixin Liu' }));
    updateBookType.mockReset().mockResolvedValue({ id: 't-1', name: 'Нон-фикшн, переводной' });
    fetchBooks.mockReset().mockResolvedValue({
      content: [
        {
          id: 'b-1',
          title: 'Задача трёх тел',
          kind: 'BOOK',
          hasCover: false,
          authors: [],
          tags: [],
          shelves: [],
          attempt: 1,
          finishedAt: '2026-02-01'
        }
      ],
      totalElements: 6,
      totalPages: 2,
      number: 0,
      size: 4
    });
  });

  /** Карточка отвечает на вопрос «что у меня есть этого автора», а не показывает одно имя. */
  it('показывает автора карточкой с состоянием чтения', async () => {
    renderPage();

    expect(await screen.findByText('Лю Цысинь')).toBeInTheDocument();
    expect(screen.getByText('6 книг · 5 дочитано')).toBeInTheDocument();
    expect(screen.getByText('9,2')).toBeInTheDocument();
    expect(screen.getByText('Осталось 1 книга')).toBeInTheDocument();
    // Обложки берутся по видимым карточкам, а не по всему справочнику.
    await waitFor(() => expect(fetchBooks).toHaveBeenCalledWith({ authorId: 'a-1', size: 4, sort: 'updatedAt,desc' }));
  });

  it('переключает справочник, не уходя со страницы', async () => {
    renderPage();
    await screen.findByText('Лю Цысинь');

    await userEvent.click(switchTo('Типы'));

    expect(await screen.findByText('Нон-фикшн')).toBeInTheDocument();
    // У типа нет ни обложек, ни оценки — ему остаётся строка со счётчиком записей.
    expect(screen.getByText('4 записи')).toBeInTheDocument();
  });

  it('переименовывает тип прямо в строке', async () => {
    renderPage();
    await screen.findByText('Лю Цысинь');
    await userEvent.click(switchTo('Типы'));

    await userEvent.click(await screen.findByLabelText('Переименовать «Нон-фикшн»'));
    const input = await screen.findByDisplayValue('Нон-фикшн');
    await userEvent.clear(input);
    await userEvent.type(input, 'Нон-фикшн, переводной{enter}');

    await waitFor(() =>
      expect(updateBookType).toHaveBeenCalledWith('t-1', { name: 'Нон-фикшн, переводной' })
    );
  });

  /** Дубли заводятся сами из карточки книги — справочник должен сказать о них первым. */
  it('предлагает объединить дубли автора', async () => {
    fetchAuthors.mockResolvedValue([
      author({}),
      author({ id: 'a-2', name: 'лю цысинь', itemCount: 2, finishedCount: 0, averageRating: undefined })
    ]);

    renderPage();

    expect(await screen.findByText(/Похоже на дубли/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Объединить' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Объединить' }));

    // Переезжает тот, у кого книг меньше: правок в библиотеке меньше.
    await waitFor(() => expect(mergeAuthors).toHaveBeenCalledWith('a-2', 'a-1'));
  });
});
