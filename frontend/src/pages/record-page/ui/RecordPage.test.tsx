import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordPage } from '@/pages/record-page';
import { LibraryItem } from '@/shared/types/library';
import { createTestStore, renderWithStore, TestStore } from '@/test/renderWithStore';

const updateBook = vi.fn();
const fetchBook = vi.fn();

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
  fetchBook: (...args: unknown[]) => fetchBook(...args),
  createBook: vi.fn(),
  updateBook: (...args: unknown[]) => updateBook(...args),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn(),
  deleteCover: vi.fn(),
  bulkUpdateBooks: vi.fn(),
  findDuplicates: vi.fn().mockResolvedValue([]),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

vi.mock('@/entities/book/api/progressApi', () => ({
  fetchSessions: vi.fn().mockResolvedValue([]),
  fetchLogs: vi.fn().mockResolvedValue([]),
  addSession: vi.fn().mockResolvedValue({}),
  deleteSession: vi.fn()
}));

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

vi.mock('@/entities/shelf/api/shelfApi', () => ({
  fetchShelves: vi.fn().mockResolvedValue([
    {
      id: 's-1',
      name: 'Подарить',
      isPublic: false,
      itemCount: 0,
      owned: true,
      canCurate: true,
      canContribute: true,
      memberCount: 0,
      createdAt: '',
      updatedAt: ''
    }
  ]),
  fetchShelfItems: vi.fn(),
  fetchShelfMembers: vi.fn(),
  addShelfMember: vi.fn(),
  removeShelfMember: vi.fn(),
  createShelf: vi.fn(),
  updateShelf: vi.fn(),
  addShelfItems: vi.fn(),
  removeShelfItems: vi.fn(),
  deleteShelf: vi.fn()
}));

const existing: LibraryItem = {
  id: 'b-1',
  title: 'Задача трёх тел',
  status: 'READING',
  favorite: false,
  wishlist: false,
  attempt: 1,
  authors: [{ id: 'a-1', name: 'Лю Цысинь' }],
  tags: [],
  shelves: [],
  hasCover: false
} as unknown as LibraryItem;

const storeWith = (item: LibraryItem): TestStore =>
  createTestStore({
    books: { items: [item], total: 1, loading: false, error: undefined },
    bookTypes: { list: [{ id: 't-1', name: 'Фантастика' }], loading: false, loaded: true },
    sources: { list: [{ id: 'src-1', name: 'Читай-город' }], loading: false, loaded: true }
  } as never);

const renderPage = (item: LibraryItem | null, store?: TestStore) =>
  renderWithStore(
    <Routes>
      <Route path="/library/:id" element={<RecordPage />} />
    </Routes>,
    store ?? (item ? storeWith(item) : createTestStore()),
    { route: '/library/b-1' }
  );

describe('RecordPage', () => {
  beforeEach(() => {
    updateBook.mockReset();
    updateBook.mockResolvedValue(existing);
    fetchBook.mockReset();
    fetchBook.mockResolvedValue(existing);
  });

  it('подставляет данные записи и сохраняет её по идентификатору', async () => {
    renderPage(existing);

    const title = await screen.findByLabelText('Название');
    await waitFor(() => expect(title).toHaveValue('Задача трёх тел'));

    await userEvent.clear(title);
    await userEvent.type(title, 'Переименована');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalledTimes(1));
    expect(updateBook.mock.calls[0][0]).toBe('b-1');
    expect(updateBook.mock.calls[0][1]).toMatchObject({ title: 'Переименована' });
  });

  /** Прямая ссылка и перезагрузка: записи в списке ещё нет, и страница обязана её запросить. */
  it('запрашивает запись по адресу, когда её нет в списке', async () => {
    renderPage(null);

    expect(await screen.findByRole('heading', { name: 'Задача трёх тел' })).toBeInTheDocument();
    expect(fetchBook).toHaveBeenCalledWith('b-1');
  });

  it('показывает «не найдено» вместо сбоя, если запись недоступна', async () => {
    fetchBook.mockRejectedValue(new Error('404'));

    renderPage(null);

    expect(await screen.findByText('Запись не найдена')).toBeInTheDocument();
  });

  it('не сохраняет карточку с пустым названием', async () => {
    renderPage(existing);

    await userEvent.clear(await screen.findByLabelText('Название'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Название обязательно')).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
  });

  it('«Отменить» возвращает поля к сохранённым значениям', async () => {
    renderPage(existing);

    const title = await screen.findByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Черновик');
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));

    await waitFor(() => expect(title).toHaveValue('Задача трёх тел'));
    expect(updateBook).not.toHaveBeenCalled();
  });

  /** Автор — сущность, но карточка присылает имена: сервер сам находит или заводит их. */
  it('отправляет авторов именами, а серию — названием', async () => {
    renderPage(existing);

    await userEvent.type(await screen.findByLabelText('Серия'), 'Воспоминания о прошлом Земли');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({
      authorNames: ['Лю Цысинь'],
      seriesName: 'Воспоминания о прошлом Земли'
    });
  });

  it('отправляет выбранную полку вместе с карточкой', async () => {
    renderPage(existing);

    // Полка выбирается из уже созданных: заводить её опечаткой в карточке нельзя.
    await userEvent.click(await screen.findByLabelText('Полки'));
    await userEvent.click(await screen.findByTitle('Подарить'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({ shelfIds: ['s-1'] });
  });

  /**
   * Вкладки монтируются по мере открытия, а сервер принимает карточку целиком: отсутствующее поле
   * он затирает. Сохранение с «Карточки» не должно стирать отзыв и оценку, которые пользователь
   * в этот раз просто не открывал. Ровно здесь и была потеря — не в интерфейсе, а в базе.
   */
  it('не теряет отзыв и оценку при сохранении с вкладки «Карточка»', async () => {
    const reviewed = {
      ...existing,
      note: 'дочитать до отпуска',
      review: 'Лучшая твёрдая фантастика',
      reviewSpoiler: 'все умерли',
      rating: 9,
      ratingPlot: 8
    } as LibraryItem;

    renderPage(reviewed, storeWith(reviewed));

    const title = await screen.findByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Переименована');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({
      title: 'Переименована',
      note: 'дочитать до отпуска',
      review: 'Лучшая твёрдая фантастика',
      reviewSpoiler: 'все умерли',
      rating: 9,
      ratingPlot: 8
    });
  });

  /**
   * Издательские поля лежат в свёрнутой строке, и до сервера доезжало только нарисованное на
   * экране: половина карточки пропадала молча. Запрос собирается по именам полей, а не по тому,
   * что смонтировано.
   */
  it('доносит до сервера свёрнутый блок «Издание и расположение»', async () => {
    renderPage(existing);

    await userEvent.click(await screen.findByText('Издание и расположение'));
    await userEvent.type(await screen.findByLabelText('ISBN'), '9785171049676');
    await userEvent.type(screen.getByLabelText('Год издания'), '2008');
    await userEvent.type(screen.getByLabelText('Переводчик'), 'Ольга Глушкова');

    // Свернуть обратно: значения не должны зависеть от того, открыт блок или нет.
    await userEvent.click(screen.getByText('Издание и расположение'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({
      isbn: '9785171049676',
      publishedYear: 2008,
      translator: 'Ольга Глушкова'
    });
  });

  it('сохраняет отзыв, написанный на вкладке «Оценка и отзыв»', async () => {
    renderPage(existing);

    await userEvent.click(await screen.findByRole('tab', { name: 'Оценка и отзыв' }));
    await userEvent.type(screen.getByLabelText('Отзыв'), 'Лучшая твёрдая фантастика');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({ review: 'Лучшая твёрдая фантастика' });
  });
});
