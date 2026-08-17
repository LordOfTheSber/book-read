import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShelvesPage } from './ShelvesPage';
import { Shelf, Tag as LibraryTag } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const createShelf = vi.fn();
const updateShelf = vi.fn();
const fetchShelves = vi.fn();
const updateTag = vi.fn();

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
    { id: 'tg-1', name: 'на лето', color: null, itemCount: 3 } as unknown as LibraryTag
  ]),
  createTag: vi.fn(),
  updateTag: (...args: unknown[]) => updateTag(...args),
  deleteTag: vi.fn()
}));

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

const renderPage = () =>
  renderWithStore(
    <MemoryRouter>
      <ShelvesPage />
    </MemoryRouter>
  );

describe('ShelvesPage', () => {
  beforeEach(() => {
    createShelf.mockReset().mockResolvedValue(shelf({ id: 's-2', name: 'Новая' }));
    updateShelf.mockReset().mockResolvedValue(shelf());
    updateTag.mockReset().mockResolvedValue({ id: 'tg-1', name: 'на осень', itemCount: 3 });
    fetchShelves.mockReset().mockResolvedValue([shelf()]);
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

    await userEvent.click(await screen.findByLabelText('Переименовать'));

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

  /** Тег переименовывается прямо в чипе, но цвет при этом терять нельзя. */
  it('переименовывает тег, сохраняя его цвет', async () => {
    renderPage();

    await userEvent.click(await screen.findByLabelText('Переименовать «на лето»'));
    const input = await screen.findByDisplayValue('на лето');
    await userEvent.clear(input);
    await userEvent.type(input, 'на осень{enter}');

    await waitFor(() => expect(updateTag).toHaveBeenCalledWith('tg-1', { name: 'на осень', color: null }));
  });
});
