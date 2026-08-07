import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicateHint } from './DuplicateHint';
import { renderWithStore } from '@/test/renderWithStore';

const findDuplicates = vi.fn();

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn(),
  deleteCover: vi.fn(),
  bulkUpdateBooks: vi.fn(),
  findDuplicates: (...args: unknown[]) => findDuplicates(...args),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

const candidate = {
  id: 'b-1',
  title: 'Задача трёх тел',
  authorNames: ['Лю Цысинь'],
  hasCover: false,
  reason: 'ISBN' as const
};

describe('DuplicateHint', () => {
  beforeEach(() => {
    findDuplicates.mockReset();
    findDuplicates.mockResolvedValue([candidate]);
  });

  it('показывает найденное совпадение вместе с причиной', async () => {
    renderWithStore(<DuplicateHint title="Задача трёх тел" />);

    expect(await screen.findByText('Похоже, такое уже есть в библиотеке')).toBeInTheDocument();
    expect(screen.getByText(/тот же ISBN/)).toBeInTheDocument();
  });

  /** Правимая запись сама себе не дубль — иначе предупреждение висело бы на каждой правке. */
  it('не показывает саму правимую запись', async () => {
    renderWithStore(<DuplicateHint title="Задача трёх тел" excludeId="b-1" />);

    await waitFor(() => expect(findDuplicates).toHaveBeenCalled());
    expect(screen.queryByText('Похоже, такое уже есть в библиотеке')).not.toBeInTheDocument();
  });

  /** По двум буквам совпадёт половина библиотеки: подсказка начинается с осмысленного ввода. */
  it('молчит, пока введено слишком мало', async () => {
    renderWithStore(<DuplicateHint title="За" />);

    await waitFor(() => expect(findDuplicates).not.toHaveBeenCalled());
  });
});
