import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

/** Знак «корешок с закладкой»: лента — единственная часть, которая меняется. */
const ribbon = (container: HTMLElement) => container.querySelectorAll('path')[0]?.getAttribute('d');

describe('Logo', () => {
  it('без цели показывает полную закладку — вне приложения знак всегда один и тот же', () => {
    const { container } = render(<Logo />);

    expect(ribbon(container)).toBe('M34 8h11v40l-5.5 -6.5L34 48z');
  });

  it('закладка растёт вместе с целью года', () => {
    const empty = render(<Logo goalProgress={0} />).container;
    const half = render(<Logo goalProgress={0.5} />).container;
    const full = render(<Logo goalProgress={1} />).container;

    expect(ribbon(empty)).toBe('M34 8h11v6l-5.5 -3L34 14z');
    expect(ribbon(half)).toBe('M34 8h11v23l-5.5 -6.5L34 31z');
    expect(ribbon(full)).toBe('M34 8h11v40l-5.5 -6.5L34 48z');
  });

  /** Знак без градиентов: прошлый логотип собирался из двух и в 16 px читался пятном. */
  it('рисуется двумя цветами без градиентов', () => {
    const { container } = render(<Logo size={16} />);

    expect(container.querySelector('linearGradient')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
