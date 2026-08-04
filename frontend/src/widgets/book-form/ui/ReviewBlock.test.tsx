import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReviewBlock } from './ReviewBlock';
import { LibraryItem } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const item = (overrides: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id: 'b-1',
    title: 'Задача трёх тел',
    status: 'COMPLETED',
    authors: [],
    hasCover: false,
    attempt: 1,
    ...overrides
  }) as LibraryItem;

describe('ReviewBlock', () => {
  /** Ради этого спойлерная часть и хранится отдельным полем. */
  it('прячет спойлеры, пока их не раскроют', async () => {
    renderWithStore(
      <ReviewBlock
        item={item({ review: 'Лучшая твёрдая фантастика', reviewSpoiler: 'Развязка с софоном оправдывает всё' })}
      />
    );

    expect(screen.getByText('Лучшая твёрдая фантастика')).toBeInTheDocument();
    expect(screen.queryByText(/Развязка с софоном/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Показать спойлеры/ }));

    expect(screen.getByText(/Развязка с софоном/)).toBeInTheDocument();
  });

  it('помечает заметку как приватную', () => {
    renderWithStore(<ReviewBlock item={item({ note: 'Купить второй том' })} />);

    expect(screen.getByText(/видна только вам/i)).toBeInTheDocument();
    expect(screen.getByText('Купить второй том')).toBeInTheDocument();
  });

  it('показывает оценки по критериям', () => {
    renderWithStore(<ReviewBlock item={item({ ratingPlot: 9.5, ratingCharacters: 7 })} />);

    expect(screen.getByText('Сюжет: 9.5')).toBeInTheDocument();
    expect(screen.getByText('Персонажи: 7')).toBeInTheDocument();
    // Незаполненный критерий не должен занимать место пустым значением.
    expect(screen.queryByText(/Финал/)).not.toBeInTheDocument();
  });

  it('подсказывает, где написать отзыв, когда его нет', () => {
    renderWithStore(<ReviewBlock item={item()} />);

    expect(screen.getByText(/Отзыва пока нет/)).toBeInTheDocument();
  });
});
