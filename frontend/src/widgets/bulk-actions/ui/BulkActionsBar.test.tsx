import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkActionsBar } from '@/widgets/bulk-actions';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';

const bulkUpdateBooks = vi.fn();

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn().mockResolvedValue({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn(),
  deleteCover: vi.fn(),
  bulkUpdateBooks: (...args: unknown[]) => bulkUpdateBooks(...args),
  findDuplicates: vi.fn().mockResolvedValue([]),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

vi.mock('@/entities/tag/api/tagApi', () => ({
  fetchTags: vi.fn().mockResolvedValue([]),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn()
}));

vi.mock('@/entities/shelf/api/shelfApi', () => ({
  fetchShelves: vi.fn().mockResolvedValue([]),
  fetchShelfItems: vi.fn(),
  createShelf: vi.fn(),
  updateShelf: vi.fn(),
  addShelfItems: vi.fn(),
  removeShelfItems: vi.fn(),
  deleteShelf: vi.fn()
}));

describe('BulkActionsBar', () => {
  beforeEach(() => {
    bulkUpdateBooks.mockReset();
    bulkUpdateBooks.mockResolvedValue({ updated: 2, skipped: [] });
  });

  it('отправляет выделение одним запросом', async () => {
    const onClear = vi.fn();
    renderWithStore(<BulkActionsBar selectedIds={['b-1', 'b-2']} onClearSelection={onClear} />, createTestStore());

    await userEvent.click(screen.getByRole('button', { name: 'В избранное' }));

    await waitFor(() => expect(bulkUpdateBooks).toHaveBeenCalledTimes(1));
    expect(bulkUpdateBooks.mock.calls[0][0]).toMatchObject({ itemIds: ['b-1', 'b-2'], favorite: true });
    // Выделение снимается только после успеха: иначе неудачную правку негде повторить.
    await waitFor(() => expect(onClear).toHaveBeenCalled());
  });

  it('показывает число записей в выделении', () => {
    renderWithStore(<BulkActionsBar selectedIds={['b-1', 'b-2']} onClearSelection={vi.fn()} />);

    expect(screen.getByText('Выбрано 2 записи')).toBeInTheDocument();
  });

  /** Чужая запись в выделении не роняет запрос — о ней сообщают числом пропущенных. */
  it('сохраняет выделение, если запрос не удался', async () => {
    bulkUpdateBooks.mockRejectedValue(new Error('Сервер недоступен'));
    const onClear = vi.fn();

    renderWithStore(<BulkActionsBar selectedIds={['b-1']} onClearSelection={onClear} />);

    await userEvent.click(screen.getByRole('button', { name: 'В желаемое' }));

    await waitFor(() => expect(bulkUpdateBooks).toHaveBeenCalled());
    expect(onClear).not.toHaveBeenCalled();
  });
});
