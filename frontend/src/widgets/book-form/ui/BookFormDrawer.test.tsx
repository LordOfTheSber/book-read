import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookFormDrawer } from '@/widgets/book-form';
import { LibraryItem } from '@/shared/types/library';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const createBook = vi.fn();
const updateBook = vi.fn();

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn(),
  createBook: (...args: unknown[]) => createBook(...args),
  updateBook: (...args: unknown[]) => updateBook(...args),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn(),
  deleteCover: vi.fn(),
  bulkUpdateBooks: vi.fn(),
  // Подсказка о дублях спрашивает сервер на каждый осмысленный ввод названия.
  findDuplicates: vi.fn().mockResolvedValue([]),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

// Форма подтягивает справочники авторов и серий — в тесте они пустые.
vi.mock('@/entities/author/api/authorApi', () => ({
  fetchAuthors: vi.fn().mockResolvedValue([]),
  createAuthor: vi.fn(),
  updateAuthor: vi.fn(),
  deleteAuthor: vi.fn()
}));

vi.mock('@/entities/series/api/seriesApi', () => ({
  fetchSeries: vi.fn().mockResolvedValue([]),
  createSeries: vi.fn(),
  updateSeries: vi.fn(),
  deleteSeries: vi.fn()
}));

vi.mock('@/entities/tag/api/tagApi', () => ({
  fetchTags: vi.fn().mockResolvedValue([]),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn()
}));

const existing: LibraryItem = {
  id: 'b-1',
  title: 'Задача трёх тел',
  status: 'READING',
  favorite: false,
  authors: [{ id: 'a-1', name: 'Лю Цысинь' }],
  hasCover: false
} as LibraryItem;

describe('BookFormDrawer', () => {
  beforeEach(() => {
    createBook.mockReset();
    updateBook.mockReset();
  });

  it('не отправляет форму без названия', async () => {
    renderWithStore(<BookFormDrawer open editing={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Название обязательно')).toBeInTheDocument();
    expect(createBook).not.toHaveBeenCalled();
  });

  it('создаёт книгу и закрывает панель', async () => {
    createBook.mockResolvedValue({ ...existing, id: 'b-2', title: 'Новая книга', authors: [] });
    const onClose = vi.fn();
    const store = createTestStore();

    renderWithStore(<BookFormDrawer open editing={null} onClose={onClose} />, store);

    await userEvent.type(screen.getByLabelText('Название'), 'Новая книга');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalledTimes(1));
    expect(createBook.mock.calls[0][0]).toMatchObject({ title: 'Новая книга', status: 'PLANNED' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Созданная книга должна сразу попасть в список, без повторной загрузки страницы.
    await waitFor(() => expect(store.getState().books.items[0]?.title).toBe('Новая книга'));
  });

  it('подставляет данные редактируемой книги и сохраняет её по идентификатору', async () => {
    updateBook.mockResolvedValue({ ...existing, title: 'Переименована' });

    renderWithStore(<BookFormDrawer open editing={existing} onClose={vi.fn()} />);

    const title = screen.getByLabelText('Название');
    await waitFor(() => expect(title).toHaveValue('Задача трёх тел'));

    await userEvent.clear(title);
    await userEvent.type(title, 'Переименована');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalledTimes(1));
    expect(updateBook.mock.calls[0][0]).toBe('b-1');
    expect(updateBook.mock.calls[0][1]).toMatchObject({ title: 'Переименована' });
  });

  /** Автор — сущность, но карточка присылает имена: сервер сам находит или заводит их. */
  it('отправляет авторов именами, а серию — названием', async () => {
    createBook.mockResolvedValue({ ...existing, id: 'b-3', authors: [] });

    renderWithStore(<BookFormDrawer open editing={null} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Название'), 'Тёмный лес');
    await userEvent.type(screen.getByLabelText('Авторы'), 'Лю Цысинь{enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(createBook.mock.calls[0][0]).toMatchObject({
      title: 'Тёмный лес',
      authorNames: ['Лю Цысинь']
    });
  });

  it('подставляет уже указанных авторов в форму редактирования', async () => {
    renderWithStore(<BookFormDrawer open editing={existing} onClose={vi.fn()} />);

    expect(await screen.findByText('Лю Цысинь')).toBeInTheDocument();
  });

  /**
   * Раздел 4 роадмапа собран на одной вкладке: отзыв и правится, и показывается там же.
   * Раньше поля жили на «Карточке», а вкладка «Отзыв» умела только показывать.
   */
  it('сохраняет отзыв, написанный на вкладке «Оценка и отзыв»', async () => {
    updateBook.mockResolvedValue({ ...existing });

    renderWithStore(<BookFormDrawer open editing={existing} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Оценка и отзыв' }));
    await userEvent.type(screen.getByLabelText('Отзыв'), 'Лучшая твёрдая фантастика');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({ review: 'Лучшая твёрдая фантастика' });
  });

  it('оставляет панель открытой, если сохранение не удалось', async () => {
    createBook.mockRejectedValue(new Error('Сервер недоступен'));
    const onClose = vi.fn();

    renderWithStore(<BookFormDrawer open editing={null} onClose={onClose} />);

    await userEvent.type(screen.getByLabelText('Название'), 'Новая книга');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
