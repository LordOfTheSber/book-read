import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BooksListWidget } from './BooksListWidget';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { LibraryItem, User } from '@/shared/types/library';

const user: User = { id: 'u1', username: 'sber', role: 'USER', blocked: false };

const item = (over: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id: 'b1',
    title: 'Задача трёх тел',
    status: 'READING',
    kind: 'BOOK',
    hasCover: false,
    favorite: false,
    wishlist: false,
    attempt: 1,
    authors: [{ id: 'a1', name: 'Лю Цысинь' }],
    tags: [],
    shelves: [],
    createdAt: '2026-02-01',
    updatedAt: '2026-02-02',
    progress: {
      current: 212,
      total: 400,
      unit: 'PAGES',
      percent: 53,
      remaining: 188,
      dailyNorm: 24,
      behindSchedule: false
    },
    ...over
  }) as LibraryItem;

const renderList = (
  items: LibraryItem[],
  props: Partial<React.ComponentProps<typeof BooksListWidget>> = {}
) => {
  const onSelectionChange = vi.fn();
  const onEdit = vi.fn();

  const store = createTestStore({
    auth: { user, authenticated: true, loadingUser: false, updatingAvatar: false },
    books: { items, page: 0, size: 20, total: items.length, loading: false }
  });

  const result = renderWithStore(
    <BooksListWidget
      viewMode="table"
      isMobile={false}
      onChangePage={vi.fn()}
      onEdit={onEdit}
      onCreate={vi.fn()}
      hasActiveFilters={false}
      onResetFilters={vi.fn()}
      selectedIds={[]}
      onSelectionChange={onSelectionChange}
      {...props}
    />,
    store
  );

  return { ...result, onSelectionChange, onEdit };
};

describe('BooksListWidget', () => {
  it('строка несёт название, автора, статус и прогресс', () => {
    renderList([item()]);

    expect(screen.getByText('Задача трёх тел')).toBeInTheDocument();
    expect(screen.getByText('Лю Цысинь')).toBeInTheDocument();
    expect(screen.getByText('Читаю')).toBeInTheDocument();
    expect(screen.getByText('212/400 стр.')).toBeInTheDocument();
  });

  /** Порядок задаётся выбором в панели, поэтому шапка списка — подписи, а не кнопки. */
  it('шапка списка не сортирует, а только называет колонки', () => {
    renderList([item()]);

    expect(screen.getByText('Запись')).toBeInTheDocument();
    expect(screen.getByText('Обновлено')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('«выбрать все» отмечает всю страницу выдачи', async () => {
    const { onSelectionChange } = renderList([item(), item({ id: 'b2', title: 'Дюна' })]);

    await userEvent.click(screen.getByLabelText('Выбрать все записи на странице'));

    expect(onSelectionChange).toHaveBeenCalledWith(['b1', 'b2']);
  });

  it('нажатие на строку открывает карточку', async () => {
    const { onEdit } = renderList([item()]);

    await userEvent.click(screen.getByText('Задача трёх тел'));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
  });

  /** На 390 px шесть колонок не помещаются: остаются обложка, название и прогресс с «+N». */
  it('на телефоне колонок нет, а быстрый шаг остаётся', () => {
    renderList([item()], { isMobile: true });

    expect(screen.queryByText('Обновлено')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument();
  });

  it('пустая библиотека и пустая выдача говорят разное', () => {
    const { unmount } = renderList([]);
    expect(screen.getByText('Библиотека пока пуста')).toBeInTheDocument();
    unmount();

    renderList([], { hasActiveFilters: true });
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('листание показывает, сколько записей всего', () => {
    renderList([item()]);

    expect(within(screen.getByRole('list')).getByText('1–1 из 1')).toBeInTheDocument();
  });
});
