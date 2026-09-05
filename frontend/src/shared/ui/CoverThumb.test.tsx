import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverThumb } from './CoverThumb';

describe('CoverThumb', () => {
  it('вместо градиента — бумажная плашка с корешком в цвете вида', () => {
    const { container } = render(<CoverThumb title="Задача трёх тел" kind="BOOK" width={36} height={50} />);

    expect(container.innerHTML).not.toContain('linear-gradient');
    expect(screen.getByText('ЗТ')).toBeInTheDocument();
    // Корешок слева — первая вложенная плашка заглушки.
    expect(container.querySelector('span')).toHaveStyle({ background: '#1B2A4A' });
  });

  it('из читаемой книги свисает закладка длиной в прогресс', () => {
    const { container } = render(
      <CoverThumb title="Дюна" kind="BOOK" width={36} height={50} progressPercent={45} />
    );

    const ribbon = Array.from(container.querySelectorAll('span')).find(
      (node) => node.style.background === 'rgb(200, 85, 47)'
    );
    expect(ribbon).toBeDefined();
    expect(ribbon).toHaveStyle({ height: '45%' });
  });

  /** Начатая книга не должна выглядеть нетронутой из-за ленты в один пиксель. */
  it('у едва начатой книги закладка всё равно заметна', () => {
    const { container } = render(
      <CoverThumb title="Дюна" kind="BOOK" width={36} height={50} progressPercent={1} />
    );

    const ribbon = Array.from(container.querySelectorAll('span')).find(
      (node) => node.style.background === 'rgb(200, 85, 47)'
    );
    expect(ribbon).toHaveStyle({ height: '4%' });
  });

  it('у записи без прогресса закладки нет', () => {
    const { container } = render(<CoverThumb title="Тёмный лес" kind="BOOK" width={36} height={50} />);

    const ribbon = Array.from(container.querySelectorAll('span')).find(
      (node) => node.style.background === 'rgb(200, 85, 47)'
    );
    expect(ribbon).toBeUndefined();
  });
});
