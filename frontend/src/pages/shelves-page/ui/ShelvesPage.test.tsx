import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelvesPage } from './ShelvesPage';
import { Shelf, TagDuplicate, Tag as LibraryTag } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const createShelf = vi.fn();
const updateShelf = vi.fn();
const fetchShelves = vi.fn();
const updateTag = vi.fn();
const fetchTagDuplicates = vi.fn();
const mergeTags = vi.fn();

vi.mock('@/entities/shelf/api/shelfApi', () => ({
  fetchShelves: (...args: unknown[]) => fetchShelves(...args),
  fetchShelfItems: vi.fn().mockResolvedValue([]),
  createShelf: (...args: unknown[]) => createShelf(...args),
  updateShelf: (...args: unknown[]) => updateShelf(...args),
  addShelfItems: vi.fn(),
  removeShelfItems: vi.fn(),
  deleteShelf: vi.fn(),
  fetchShelfMembers: vi.fn().mockResolvedValue([]),
  addShelfMember: vi.fn(),
  removeShelfMember: vi.fn(),
  fetchShelfMemberCandidates: vi.fn().mockResolvedValue([])
}));

vi.mock('@/entities/tag/api/tagApi', () => ({
  fetchTags: vi.fn().mockResolvedValue([
    { id: 'tg-1', name: 'на лето', color: null, itemCount: 3 } as unknown as LibraryTag,
    { id: 'tg-2', name: 'фантастика', color: null, itemCount: 12 } as unknown as LibraryTag
  ]),
  createTag: vi.fn(),
  updateTag: (...args: unknown[]) => updateTag(...args),
  deleteTag: vi.fn(),
  fetchTagDuplicates: (...args: unknown[]) => fetchTagDuplicates(...args),
  mergeTags: (...args: unknown[]) => mergeTags(...args)
}));

const tag = (id: string, name: string, itemCount: number) =>
  ({ id, name, itemCount, createdAt: '', updatedAt: '' }) as LibraryTag;

const duplicate: TagDuplicate = {
  source: tag('tg-1', 'сай-фай', 9),
  target: tag('tg-2', 'фантастика', 64),
  overlap: 7
};

const shelf = (overrides: Partial<Shelf> = {}): Shelf =>
  ({
    id: 's-1',
    name: 'Книжный клуб',
    description: 'весенний список',
    isPublic: false,
    itemCount: 2,
    owned: true,
    canCurate: true,
    canContribute: true,
    memberCount: 0,
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides
  }) as Shelf;

const renderPage = () => renderWithStore(<ShelvesPage />);

describe('ShelvesPage', () => {
  beforeEach(() => {
    createShelf.mockReset().mockResolvedValue(shelf({ id: 's-2', name: 'Новая' }));
    updateShelf.mockReset().mockResolvedValue(shelf());
    updateTag.mockReset().mockResolvedValue({ id: 'tg-1', name: 'на осень', itemCount: 3 });
    fetchShelves.mockReset().mockResolvedValue([shelf()]);
    fetchTagDuplicates.mockReset().mockResolvedValue([]);
    mergeTags.mockReset().mockResolvedValue(tag('tg-2', 'фантастика', 73));
  });

  it('создаёт полку со всеми полями формы', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Новая полка/ }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Название'), 'Книжный клуб, весна');
    await userEvent.type(within(dialog).getByLabelText('Описание'), 'что читаем в марте');
    await userEvent.click(within(dialog).getByLabelText('Публичная'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(createShelf).toHaveBeenCalledWith({
        name: 'Книжный клуб, весна',
        description: 'что читаем в марте',
        isPublic: true
      })
    );
  });

  /** Правка одного поля не должна стирать остальные: сервер принимает полку целиком. */
  it('сохраняет полку целиком, когда правят только название', async () => {
    renderPage();

    await userEvent.click(await screen.findByLabelText('Переименовать полку «Книжный клуб»'));

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Название');
    await waitFor(() => expect(name).toHaveValue('Книжный клуб'));

    await userEvent.clear(name);
    await userEvent.type(name, 'Книжный клуб, осень');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(updateShelf).toHaveBeenCalledWith('s-1', {
        name: 'Книжный клуб, осень',
        description: 'весенний список',
        isPublic: false
      })
    );
  });

  it('не создаёт полку без названия', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Новая полка/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Название обязательно')).toBeInTheDocument();
    expect(createShelf).not.toHaveBeenCalled();
  });

  /** Тег переименовывается прямо в строке, но цвет при этом терять нельзя. */
  it('переименовывает тег, сохраняя его цвет', async () => {
    renderPage();

    await userEvent.click(await screen.findByLabelText('Переименовать «на лето»'));
    const input = await screen.findByDisplayValue('на лето');
    await userEvent.clear(input);
    await userEvent.type(input, 'на осень{enter}');

    await waitFor(() => expect(updateTag).toHaveBeenCalledWith('tg-1', { name: 'на осень', color: null }));
  });

  /**
   * Дубли не видно ни по именам, ни по счётчикам: «сай-фай» и «фантастика» стоят на одних
   * и тех же книгах, и заметить это можно только по пересечению.
   */
  it('предлагает объединить теги, стоящие на одних записях', async () => {
    fetchTagDuplicates.mockResolvedValue([duplicate]);
    renderPage();

    expect(await screen.findByText(/«сай-фай» и «фантастика» — одно и то же/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Объединить/ }));

    // Последствия называются числами до нажатия: объединение необратимо.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/снимется с 9 записей/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Объединить' }));

    await waitFor(() => expect(mergeTags).toHaveBeenCalledWith('tg-1', 'tg-2'));
  });

  it('убирает подсказку по «Оставить как есть»', async () => {
    fetchTagDuplicates.mockResolvedValue([duplicate]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Оставить как есть' }));

    expect(screen.queryByText(/одно и то же/)).not.toBeInTheDocument();
    expect(mergeTags).not.toHaveBeenCalled();
  });
});
