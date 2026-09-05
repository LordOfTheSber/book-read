import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BooksToolbarWidget } from './BooksToolbarWidget';
import { renderWithStore } from '@/test/renderWithStore';

const renderToolbar = (props: Partial<React.ComponentProps<typeof BooksToolbarWidget>> = {}) => {
  const onLayoutChange = vi.fn();

  renderWithStore(
    <BooksToolbarWidget
      search=""
      onSearchChange={vi.fn()}
      sort="updatedAt,desc"
      onSortChange={vi.fn()}
      viewMode="table"
      onViewModeChange={vi.fn()}
      layout="list"
      onLayoutChange={onLayoutChange}
      onOpenFilters={vi.fn()}
      activeFilterCount={0}
      isMobile={false}
      smartShelves={<button type="button">Умные полки</button>}
      {...props}
    />
  );

  return { onLayoutChange };
};

describe('BooksToolbarWidget', () => {
  it('в списке фильтры и умные полки стоят в панели', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: /Фильтры/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Умные полки' })).toBeInTheDocument();
  });

  /** В рабочем столе то и другое живёт в рельсе — вторая кнопка вела бы в то же место. */
  it('в рабочем столе фильтров и полок в панели нет', () => {
    renderToolbar({ layout: 'desk' });

    expect(screen.queryByRole('button', { name: /Фильтры/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Умные полки' })).not.toBeInTheDocument();
  });

  it('переключатель раскладки меняет её на противоположную', async () => {
    const { onLayoutChange } = renderToolbar();

    await userEvent.click(screen.getByRole('button', { name: 'Показать рельс полок' }));

    expect(onLayoutChange).toHaveBeenCalledWith('desk');
  });

  /** 258 px рельса из 390 забрать нельзя, поэтому на телефоне переключателя нет вовсе. */
  it('на телефоне переключателя раскладки нет', () => {
    renderToolbar({ isMobile: true });

    expect(screen.queryByRole('button', { name: /рельс полок/ })).not.toBeInTheDocument();
  });
});
