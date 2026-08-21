import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LibraryRail } from './LibraryRail';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { Shelf } from '@/shared/types/library';

const shelf = (id: string, name: string, itemCount: number): Shelf => ({
  id,
  name,
  isPublic: false,
  itemCount,
  owned: true,
  canCurate: true,
  canContribute: true,
  memberCount: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
});

const renderRail = (shelfId?: string) => {
  const store = createTestStore({
    bookFilters: { page: 0, size: 20, sort: 'updatedAt,desc', shelfId },
    shelves: {
      list: [shelf('s1', 'Дома на полке', 64), shelf('s2', 'Читаем с Аней', 12)],
      loading: false,
      loaded: true
    }
  });

  return { ...renderWithStore(<LibraryRail />, store), store };
};

describe('LibraryRail', () => {
  it('показывает полки со счётчиками и текущую как выбранную', () => {
    renderRail('s1');

    expect(screen.getByRole('button', { name: /Дома на полке 64/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Читаем с Аней 12/ })).toBeInTheDocument();
  });

  it('нажатие на полку кладёт её в фильтры, повторное — снимает', async () => {
    const { store } = renderRail();

    await userEvent.click(screen.getByRole('button', { name: /Дома на полке/ }));
    expect(store.getState().bookFilters.shelfId).toBe('s1');

    await userEvent.click(screen.getByRole('button', { name: /Дома на полке/ }));
    expect(store.getState().bookFilters.shelfId).toBeUndefined();
  });

  /**
   * Статус стоит чипами над списком, полки — списком выше в самом рельсе. Второй раз
   * спрашивать то же самое значит показывать два разных ответа на один вопрос.
   */
  it('в фильтрах рельса нет ни статуса, ни полки — они рядом', () => {
    renderRail();

    expect(screen.getByLabelText('Вид')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Статус' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Полка')).not.toBeInTheDocument();
  });

  it('«Сбросить» очищает набор фильтров целиком', async () => {
    const { store } = renderRail('s1');

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(store.getState().bookFilters.shelfId).toBeUndefined();
  });
});
