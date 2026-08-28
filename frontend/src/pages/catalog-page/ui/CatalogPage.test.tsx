import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogPage } from './CatalogPage';
import { Author, BookType, Source } from '@/shared/types/library';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const fetchAuthors = vi.fn();
const updateAuthor = vi.fn();
const mergeAuthors = vi.fn();
const fetchAuthorShowcase = vi.fn();
const updateSource = vi.fn();

vi.mock('@/entities/author/api/authorApi', () => ({
  fetchAuthors: (...args: unknown[]) => fetchAuthors(...args),
  createAuthor: vi.fn(),
  updateAuthor: (...args: unknown[]) => updateAuthor(...args),
  deleteAuthor: vi.fn(),
  mergeAuthors: (...args: unknown[]) => mergeAuthors(...args),
  fetchAuthorShowcase: (...args: unknown[]) => fetchAuthorShowcase(...args)
}));

vi.mock('@/entities/series/api/seriesApi', () => ({
  fetchSeries: vi.fn().mockResolvedValue([]),
  createSeries: vi.fn(),
  updateSeries: vi.fn(),
  deleteSeries: vi.fn(),
  fetchSeriesShowcase: vi.fn().mockResolvedValue({})
}));

vi.mock('@/entities/book-type/api/bookTypeApi', () => ({
  fetchBookTypes: vi.fn().mockResolvedValue([
    { id: 't-1', name: 'Нон-фикшн', createdAt: '', updatedAt: '2026-03-01T10:00:00Z' } as BookType
  ]),
  createBookType: vi.fn(),
  updateBookType: vi.fn(),
  deleteBookType: vi.fn()
}));

vi.mock('@/entities/source/api/sourceApi', () => ({
  fetchSources: vi.fn().mockResolvedValue([
    {
      id: 'sr-1',
      name: 'Читай-город',
      url: 'https://chitai-gorod.ru',
      description: 'бумажные, самовывоз',
      createdAt: '',
      updatedAt: '2026-03-01T10:00:00Z'
    } as Source
  ]),
  createSource: vi.fn(),
  updateSource: (...args: unknown[]) => updateSource(...args),
  deleteSource: vi.fn()
}));

const author = (overrides: Partial<Author> = {}): Author =>
  ({
    id: 'a-1',
    name: 'Лю Цысинь',
    itemCount: 6,
    finishedCount: 5,
    avgRating: 9.2,
    createdAt: '',
    updatedAt: '',
    ...overrides
  }) as Author;

const admin = () =>
  createTestStore({
    auth: {
      authenticated: true,
      loadingUser: false,
      user: { id: 'u-1', username: 'sber', role: 'ADMIN' }
    }
  } as never);

const renderPage = (route = '/catalog') => renderWithStore(<CatalogPage />, admin(), { route });

describe('CatalogPage', () => {
  beforeEach(() => {
    fetchAuthors.mockReset().mockResolvedValue([author()]);
    updateAuthor.mockReset().mockResolvedValue(author({ name: 'Liu Cixin' }));
    mergeAuthors.mockReset().mockResolvedValue(author({ itemCount: 8 }));
    fetchAuthorShowcase.mockReset().mockResolvedValue({
      'a-1': [{ id: 'i-1', title: 'Задача трёх тел', kind: 'BOOK', status: 'COMPLETED', hasCover: false }]
    });
    updateSource.mockReset().mockResolvedValue({
      id: 'sr-1',
      name: 'Лабиринт',
      url: 'https://chitai-gorod.ru',
      description: 'бумажные, самовывоз'
    });
  });

  /** Четыре справочника открываются на одной странице, а не четырьмя пунктами меню. */
  it('переключает справочник рельсом слева', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Лю Цысинь')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Источники/ }));

    expect(await screen.findByText('Читай-город')).toBeInTheDocument();
    expect(screen.queryByText('Лю Цысинь')).not.toBeInTheDocument();
  });

  /** Карточка автора отвечает, что из него прочитано, — ради этого справочник и открывают. */
  it('показывает на карточке автора обложки, оценку и что осталось', async () => {
    renderPage();

    expect(await screen.findByText('Лю Цысинь')).toBeInTheDocument();
    expect(screen.getByText('9,2')).toBeInTheDocument();
    expect(screen.getByText('Осталось 1 запись')).toBeInTheDocument();
    await waitFor(() => expect(fetchAuthorShowcase).toHaveBeenCalledWith(['a-1']));
  });

  /** Тип и источник — это слово: открывать окно ради переименования незачем. */
  it('переименовывает источник прямо в строке, не теряя остальных полей', async () => {
    const user = userEvent.setup();
    renderPage('/catalog?entity=sources');

    const name = await screen.findByText('Читай-город');
    await user.click(name);

    const input = screen.getByLabelText('Название «Читай-город»');
    await user.clear(input);
    await user.type(input, 'Лабиринт{Enter}');

    await waitFor(() =>
      expect(updateSource).toHaveBeenCalledWith('sr-1', {
        name: 'Лабиринт',
        url: 'https://chitai-gorod.ru',
        description: 'бумажные, самовывоз'
      })
    );
  });

  /** Дубли заводятся сами из карточки; заметить их, листая двести имён, нельзя. */
  it('предлагает объединить автора, записанного дважды', async () => {
    fetchAuthors.mockResolvedValue([author(), author({ id: 'a-2', name: 'лю цысинь ', itemCount: 2 })]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/Похоже на дубли/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Объединить' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Объединить' }));

    await waitFor(() => expect(mergeAuthors).toHaveBeenCalledWith('a-1', 'a-2'));
  });

  /** Подсказка не должна возвращаться на каждый вход, если её один раз отклонили. */
  it('убирает подсказку про дубли по «Оставить как есть»', async () => {
    fetchAuthors.mockResolvedValue([author(), author({ id: 'a-2', name: 'лю цысинь ', itemCount: 2 })]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Оставить как есть' }));

    expect(screen.queryByText(/Похоже на дубли/)).not.toBeInTheDocument();
  });
});
