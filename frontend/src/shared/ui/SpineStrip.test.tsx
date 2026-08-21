import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SpineStrip } from './SpineStrip';
import { renderWithStore } from '@/test/renderWithStore';

describe('SpineStrip', () => {
  const shares = [
    { kind: 'BOOK' as const, count: 104 },
    { kind: 'MANGA' as const, count: 40 },
    { kind: 'GAME' as const, count: 6 }
  ];

  it('ширина корешка — доля вида, и она названа в подписи', () => {
    renderWithStore(<SpineStrip shares={shares} />);

    const book = screen.getByLabelText('Книга · 104 записи · 69%');
    expect(book).toHaveStyle({ flexGrow: '104' });
    expect(screen.getByText('Книга · 69%')).toBeInTheDocument();
  });

  it('пустые виды в полосу не попадают', () => {
    renderWithStore(<SpineStrip shares={[...shares, { kind: 'ANIME', count: 0 }]} />);

    expect(screen.queryByText(/Аниме/)).not.toBeInTheDocument();
  });

  it('корешок ведёт к записям этого вида', async () => {
    const onSelect = vi.fn();
    renderWithStore(<SpineStrip shares={shares} onSelect={onSelect} />);

    await userEvent.click(screen.getByLabelText(/^Манга/));

    expect(onSelect).toHaveBeenCalledWith('MANGA');
  });

  /** Совсем пустая библиотека не должна рисовать полосу нулевой ширины. */
  it('без записей не рисуется вовсе', () => {
    const { container } = renderWithStore(<SpineStrip shares={[]} />);

    // Обёртка провайдеров остаётся, а самой полосы внутри нет.
    expect(container.querySelector('button')).toBeNull();
  });
});
