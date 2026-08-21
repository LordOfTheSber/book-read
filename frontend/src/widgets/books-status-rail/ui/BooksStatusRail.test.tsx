import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BooksStatusRail } from './BooksStatusRail';
import { renderWithStore } from '@/test/renderWithStore';
import type { BookAnalytics } from '@/shared/types/library';

const analytics: BookAnalytics = {
  totalItems: 248,
  favoriteItems: 32,
  averageRating: 8.4,
  statusBreakdown: { READING: 6, PLANNED: 41, COMPLETED: 186, ON_HOLD: 9, DROPPED: 6 },
  topTypes: [],
  topSources: []
};

const renderRail = (props: Partial<React.ComponentProps<typeof BooksStatusRail>> = {}) => {
  const handlers = {
    onSelectStatus: vi.fn(),
    onToggleFavorite: vi.fn(),
    onToggleWishlist: vi.fn()
  };

  renderWithStore(
    <BooksStatusRail analytics={analytics} loading={false} isMobile={false} {...handlers} {...props} />
  );

  return handlers;
};

describe('BooksStatusRail', () => {
  it('показывает счётчики срезов вместо пяти плиток-метрик', () => {
    renderRail();

    expect(screen.getByRole('button', { name: /Всё 248/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Читаю 6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Завершено 186/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Избранное 32/ })).toBeInTheDocument();
  });

  /** Без фильтров открыт весь список — и рельс должен отвечать на вопрос «что сейчас показано». */
  it('без фильтров активно «Всё», с фильтром — выбранный статус', () => {
    const { rerender } = renderWithStore(
      <BooksStatusRail
        analytics={analytics}
        loading={false}
        isMobile={false}
        onSelectStatus={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Всё/ })).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <BooksStatusRail
        analytics={analytics}
        loading={false}
        isMobile={false}
        status="READING"
        onSelectStatus={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Читаю/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Всё/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('повторное нажатие на выбранный статус снимает срез', async () => {
    const handlers = renderRail({ status: 'READING' });

    await userEvent.click(screen.getByRole('button', { name: /Читаю/ }));

    expect(handlers.onSelectStatus).toHaveBeenCalledWith(undefined);
  });

  it('нажатие на другой статус выбирает его', async () => {
    const handlers = renderRail({ status: 'READING' });

    await userEvent.click(screen.getByRole('button', { name: /В планах/ }));

    expect(handlers.onSelectStatus).toHaveBeenCalledWith('PLANNED');
  });

  it('избранное и желаемое переключаются отдельно от статусов', async () => {
    const handlers = renderRail();

    await userEvent.click(screen.getByRole('button', { name: /Избранное/ }));
    await userEvent.click(screen.getByRole('button', { name: /Желаемое/ }));

    expect(handlers.onToggleFavorite).toHaveBeenCalled();
    expect(handlers.onToggleWishlist).toHaveBeenCalled();
  });
});
