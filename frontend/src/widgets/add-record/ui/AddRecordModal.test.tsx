import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddRecordModal } from '@/widgets/add-record';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const createBook = vi.fn();

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn(),
  createBook: (...args: unknown[]) => createBook(...args),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn().mockResolvedValue(undefined),
  deleteCover: vi.fn(),
  bulkUpdateBooks: vi.fn(),
  findDuplicates: vi.fn().mockResolvedValue([]),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
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

vi.mock('@/entities/metadata/api/metadataApi', () => ({
  searchMetadata: vi.fn().mockResolvedValue([
    {
      provider: 'OPEN_LIBRARY',
      title: 'Задача трёх тел',
      authorNames: ['Лю Цысинь'],
      isbn: '9785171049676',
      publishedYear: 2006,
      language: 'ru',
      pageCount: 400,
      publisher: 'Эксмо',
      coverUrl: 'https://covers.example/1.jpg'
    }
  ])
}));

const created = {
  id: 'b-1',
  title: 'Задача трёх тел',
  status: 'PLANNED',
  favorite: false,
  authors: [],
  hasCover: false
};

/** Пройти шаг поиска до подтверждения: этим начинаются почти все проверки. */
const searchAndPick = async () => {
  await userEvent.type(screen.getByPlaceholderText('Название, автор или ISBN'), 'задача трёх тел');
  await userEvent.click(screen.getByRole('button', { name: 'Найти' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Выбрать' }));
};

describe('AddRecordModal', () => {
  beforeEach(() => {
    createBook.mockReset();
    createBook.mockResolvedValue(created);
  });

  it('начинается с поиска по каталогам, а не с формы', () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    expect(screen.getByPlaceholderText('Название, автор или ISBN')).toBeInTheDocument();
    // Полей карточки на первом шаге нет вовсе: сначала находка, потом подтверждение.
    expect(screen.queryByLabelText('Авторы')).not.toBeInTheDocument();
  });

  it('находка каталога заполняет шаг подтверждения объёмом из издания', async () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await searchAndPick();

    expect(await screen.findByText('обложка подтянется при сохранении')).toBeInTheDocument();
    expect(screen.getByLabelText('Объём')).toHaveValue('400');
  });

  it('добавляет найденную запись вместе с издательскими полями каталога', async () => {
    const onClose = vi.fn();
    const store = createTestStore();

    renderWithStore(<AddRecordModal open onClose={onClose} onOpenRecord={vi.fn()} />, store);

    await searchAndPick();
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalledTimes(1));
    expect(createBook.mock.calls[0][0]).toMatchObject({
      title: 'Задача трёх тел',
      authorNames: ['Лю Цысинь'],
      status: 'PLANNED',
      kind: 'BOOK',
      progressTotal: 400,
      isbn: '9785171049676',
      publishedYear: 2006,
      language: 'ru'
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Созданная запись должна сразу попасть в список, без повторной загрузки страницы.
    await waitFor(() => expect(store.getState().books.items[0]?.id).toBe('b-1'));
  });

  it('заводит запись вручную по одному названию', async () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Не нашлось? Завести вручную' }));
    await userEvent.type(await screen.findByLabelText('Название'), 'Тёмный лес');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(createBook.mock.calls[0][0]).toMatchObject({ title: 'Тёмный лес', status: 'PLANNED', kind: 'BOOK' });
  });

  it('не отправляет ручную форму без названия', async () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Не нашлось? Завести вручную' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Название обязательно')).toBeInTheDocument();
    expect(createBook).not.toHaveBeenCalled();
  });

  it('статус и вид выбираются чипами, а не выпадающим списком', async () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Не нашлось? Завести вручную' }));
    await userEvent.type(await screen.findByLabelText('Название'), 'Дюна');
    await userEvent.click(screen.getByRole('button', { name: 'Читаю' }));
    await userEvent.click(screen.getByRole('button', { name: 'Аудиокнига' }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBook).toHaveBeenCalled());
    expect(createBook.mock.calls[0][0]).toMatchObject({ status: 'READING', kind: 'AUDIOBOOK' });
  });

  it('«Добавить и открыть карточку» уводит в панель правки созданной записи', async () => {
    const onOpenRecord = vi.fn();

    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={onOpenRecord} />);

    await searchAndPick();
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить и открыть карточку' }));

    await waitFor(() => expect(onOpenRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1' })));
  });

  /**
   * Форма живёт в самом окне и переживает его закрытие: без сброса следующее открытие приходило
   * с названием и авторами прошлой находки и заводило второй экземпляр той же записи.
   */
  it('не помнит прошлую находку при повторном открытии', async () => {
    const { rerender } = renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await searchAndPick();
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить', exact: true }));
    await waitFor(() => expect(createBook).toHaveBeenCalled());

    rerender(<AddRecordModal open={false} onClose={vi.fn()} onOpenRecord={vi.fn()} />);
    rerender(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Не нашлось? Завести вручную' }));
    expect(await screen.findByLabelText('Название')).toHaveValue('');
  });

  it('«Поправить данные» открывает ручную форму с подставленным названием', async () => {
    renderWithStore(<AddRecordModal open onClose={vi.fn()} onOpenRecord={vi.fn()} />);

    await searchAndPick();
    await userEvent.click(await screen.findByRole('button', { name: 'Поправить данные' }));

    expect(await screen.findByLabelText('Название')).toHaveValue('Задача трёх тел');
  });
});
