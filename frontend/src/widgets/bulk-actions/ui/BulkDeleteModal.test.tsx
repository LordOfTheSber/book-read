import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkDeleteModal } from './BulkDeleteModal';
import { renderWithStore } from '@/test/renderWithStore';

const previewBulkDelete = vi.fn();

vi.mock('@/entities/book/api/bookApi', async () => {
  const actual = await vi.importActual<typeof import('@/entities/book/api/bookApi')>('@/entities/book/api/bookApi');
  return { ...actual, previewBulkDelete: (...args: unknown[]) => previewBulkDelete(...args) };
});

describe('BulkDeleteModal', () => {
  beforeEach(() => {
    previewBulkDelete.mockReset().mockResolvedValue({
      items: 17,
      skipped: 2,
      quotes: 26,
      itemsWithQuotes: 4,
      sessions: 12,
      reviews: 3
    });
  });

  /**
   * Записи заводятся заново за минуту, а выписки человек вводил руками: цена удаления должна
   * стоять в диалоге числами, а не выясняться после.
   */
  it('называет последствия числами и не пускает без слова', async () => {
    renderWithStore(<BulkDeleteModal open itemIds={['a', 'b']} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(await screen.findByText('Удалить 17 записей?')).toBeInTheDocument();
    expect(screen.getByText(/у 4 из них 26 выписок, 12 заходов, 3 отзыва/)).toBeInTheDocument();
    expect(screen.getByText(/Чужие записи не удаляются: 2 из выделения/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled();
  });

  it('разрешает удаление после набранного слова', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithStore(<BulkDeleteModal open itemIds={['a']} onCancel={vi.fn()} onConfirm={onConfirm} />);

    await userEvent.type(await screen.findByLabelText('Слово для подтверждения'), 'удалить');
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });
});
