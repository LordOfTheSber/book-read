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

vi.mock('@/entities/metadata/api/metadataApi', () => ({
  searchMetadata: vi.fn().mockResolvedValue([
    {
      provider: 'OPEN_LIBRARY',
      title: 'Тёмный лес',
      authorNames: ['Лю Цысинь'],
      isbn: '9785171049676',
      publishedYear: 2008,
      language: 'ru',
      pageCount: 450,
      publisher: 'Эксмо'
    }
  ])
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
  authors: [{ id: 'a-1', name: 'Лю Цысинь' }],
  hasCover: false
} as LibraryItem;

/** Пустая запись: нужна проверкам, которые заполняют карточку с нуля и сверяют весь запрос. */
const blank: LibraryItem = { ...existing, id: 'b-6', title: 'Черновик', status: 'PLANNED', authors: [] };

describe('BookFormDrawer', () => {
  beforeEach(() => {
    createBook.mockReset();
    updateBook.mockReset();
  });

  it('не сохраняет карточку с пустым названием', async () => {
    renderWithStore(<BookFormDrawer open editing={existing} onClose={vi.fn()} />);

    await userEvent.clear(await screen.findByLabelText('Название'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Название обязательно')).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
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
    updateBook.mockResolvedValue({ ...blank });

    renderWithStore(<BookFormDrawer open editing={blank} onClose={vi.fn()} />);

    const title = await screen.findByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Тёмный лес');
    await userEvent.type(screen.getByLabelText('Авторы'), 'Лю Цысинь{enter}');
    await userEvent.type(screen.getByLabelText('Серия'), 'Воспоминания о прошлом Земли');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({
      title: 'Тёмный лес',
      authorNames: ['Лю Цысинь'],
      seriesName: 'Воспоминания о прошлом Земли'
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

  /**
   * Полки и серия — связи, а не издательские подробности. Серия раньше лежала в свёрнутом блоке,
   * а положить запись на полку из карточки было нельзя вовсе: только выделением в списке.
   */
  it('отправляет выбранную полку вместе с карточкой', async () => {
    updateBook.mockResolvedValue({ ...blank, shelves: [] });

    renderWithStore(<BookFormDrawer open editing={blank} onClose={vi.fn()} />);

    // Полка выбирается из уже созданных: заводить её опечаткой в карточке нельзя.
    await userEvent.click(await screen.findByLabelText('Полки'));
    await userEvent.click(await screen.findByTitle('Подарить'));

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({ shelfIds: ['s-1'] });
  });

  /**
   * Издательские поля лежат в свёрнутом блоке, а каталог заполняет их не глядя на то, раскрыт он
   * или нет. Раньше до сервера доезжало только то, что нарисовано на экране, и половина карточки,
   * собранной по каталогу, пропадала молча.
   */
  it('сохраняет данные из каталога, даже если блок «Издание» не раскрывали', async () => {
    updateBook.mockResolvedValue({ ...blank });

    renderWithStore(<BookFormDrawer open editing={blank} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Найти в каталогах/ }));
    await userEvent.type(await screen.findByPlaceholderText('Название, автор или ISBN'), 'тёмный лес');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Заполнить' }));

    await waitFor(() => expect(screen.getByLabelText('Название')).toHaveValue('Тёмный лес'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toMatchObject({
      title: 'Тёмный лес',
      authorNames: ['Лю Цысинь'],
      isbn: '9785171049676',
      publishedYear: 2008,
      language: 'ru',
      pageCount: 450
    });
  });

  /**
   * Вкладки монтируются по мере открытия, а сервер принимает карточку целиком: отсутствующее поле
   * он затирает. Сохранение с «Карточки» не должно стирать отзыв и оценку, которые пользователь
   * в этот раз просто не открывал.
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
    updateBook.mockResolvedValue(reviewed);

    renderWithStore(<BookFormDrawer open editing={reviewed} onClose={vi.fn()} />);

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
   * Главная проверка карточки: всё, что человек ввёл, должно доехать до сервера. Ровно здесь
   * и была потеря — половина полей живёт в свёрнутом блоке и на отдельной вкладке, а до запроса
   * доезжало только нарисованное на экране.
   */
  it('отправляет на сервер каждое заполненное поле', async () => {
    updateBook.mockResolvedValue({ ...blank });
    const store = createTestStore({
      bookTypes: { list: [{ id: 't-1', name: 'Фантастика' }], loading: false, loaded: true },
      sources: { list: [{ id: 'src-1', name: 'Читай-город' }], loading: false, loaded: true }
    } as never);

    renderWithStore(<BookFormDrawer open editing={blank} onClose={vi.fn()} />, store);

    const pickOption = async (fieldLabel: string, option: string) => {
      await userEvent.click(screen.getByLabelText(fieldLabel));
      await userEvent.click(await screen.findByTitle(option));
    };

    const title = await screen.findByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Тёмный лес');
    await userEvent.type(screen.getByLabelText('Альтернативное название'), 'The Dark Forest');
    await userEvent.type(screen.getByLabelText('Авторы'), 'Лю Цысинь{enter}');
    await userEvent.type(screen.getByLabelText('Теги'), 'перечитать{enter}');
    await userEvent.click(screen.getByLabelText('Избранное'));

    await userEvent.type(screen.getByLabelText('Серия'), 'Воспоминания о прошлом Земли');
    await userEvent.type(screen.getByLabelText('Номер в серии'), '2');
    await pickOption('Полки', 'Подарить');

    await pickOption('Вид', 'Манга');
    await pickOption('Тип', 'Фантастика');
    await pickOption('Источник', 'Читай-город');

    await pickOption('Статус', 'Читаю');
    await userEvent.type(screen.getByLabelText('Объём'), '500');
    await pickOption('Единица', 'Тома');

    await userEvent.type(screen.getByLabelText('Начато'), '01.02.2026{enter}');
    await userEvent.type(screen.getByLabelText('Завершено'), '03.03.2026{enter}');
    await userEvent.type(screen.getByLabelText('Дочитать к'), '04.04.2026{enter}');

    await userEvent.click(screen.getByLabelText('В желаемом'));
    await userEvent.type(screen.getByLabelText('Цена'), '899');
    await userEvent.type(screen.getByLabelText('Валюта'), 'RUB');
    await userEvent.type(screen.getByLabelText('Ссылка на покупку'), 'https://example.com/book');

    // Издательский блок свёрнут: до правки его содержимое до сервера не доезжало.
    await userEvent.click(screen.getByText('Издание и расположение'));
    await userEvent.type(await screen.findByLabelText('ISBN'), '9785171049676');
    await userEvent.type(screen.getByLabelText('Год издания'), '2008');
    await userEvent.type(screen.getByLabelText('Язык'), 'ru');
    await userEvent.type(screen.getByLabelText('Страниц в издании'), '450');
    await pickOption('Формат', 'Бумажная');
    await userEvent.type(screen.getByLabelText('Переводчик'), 'Ольга Глушкова');
    await userEvent.type(screen.getByLabelText('Шкаф'), 'Гостиная');
    await userEvent.type(screen.getByLabelText('Полка'), 'Вторая сверху');

    // Заметка и отзыв живут на своей вкладке: панель правки собирает запрос со всех сразу.
    await userEvent.click(screen.getByRole('tab', { name: 'Оценка и отзыв' }));
    await userEvent.type(await screen.findByLabelText('Заметка'), 'дочитать до отпуска');
    await userEvent.type(screen.getByLabelText('Отзыв'), 'Лучшая твёрдая фантастика');
    await userEvent.type(screen.getByLabelText('Под спойлер-катом'), 'все умерли');

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(updateBook.mock.calls[0][1]).toEqual({
      kind: 'MANGA',
      title: 'Тёмный лес',
      altTitle: 'The Dark Forest',
      typeId: 't-1',
      sourceId: 'src-1',
      authorNames: ['Лю Цысинь'],
      tagNames: ['перечитать'],
      shelfIds: ['s-1'],
      seriesName: 'Воспоминания о прошлом Земли',
      orderInSeries: 2,
      isbn: '9785171049676',
      publishedYear: 2008,
      language: 'ru',
      pageCount: 450,
      translator: 'Ольга Глушкова',
      format: 'PAPER',
      bookcase: 'Гостиная',
      shelf: 'Вторая сверху',
      startedAt: '2026-02-01',
      finishedAt: '2026-03-03',
      deadline: '2026-04-04',
      progressTotal: 500,
      progressUnit: 'VOLUMES',
      note: 'дочитать до отпуска',
      review: 'Лучшая твёрдая фантастика',
      reviewSpoiler: 'все умерли',
      rating: undefined,
      ratingPlot: undefined,
      ratingStyle: undefined,
      ratingCharacters: undefined,
      ratingEnding: undefined,
      favorite: true,
      wishlist: true,
      price: 899,
      currency: 'RUB',
      purchaseUrl: 'https://example.com/book',
      status: 'READING'
    });
  }, 60000);

  it('оставляет панель открытой, если сохранение не удалось', async () => {
    updateBook.mockRejectedValue(new Error('Сервер недоступен'));
    const onClose = vi.fn();

    renderWithStore(<BookFormDrawer open editing={existing} onClose={onClose} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBook).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('закрывает нетронутую карточку сразу, без лишнего вопроса', async () => {
    const onClose = vi.fn();

    renderWithStore(<BookFormDrawer open editing={existing} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('переспрашивает перед закрытием, если введённое ещё не сохранено', async () => {
    const onClose = vi.fn();

    renderWithStore(<BookFormDrawer open editing={existing} onClose={onClose} />);

    await userEvent.type(await screen.findByLabelText('Название'), ' и продолжение');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    // Панель остаётся открытой, пока человек не подтвердит потерю ввода.
    await userEvent.click(await screen.findByRole('button', { name: 'Вернуться к правке' }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Закрыть' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  }, 30000);
});
