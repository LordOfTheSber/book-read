import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YearCard } from './YearCard';
import type { YearInReview } from '@/shared/types/library';

/**
 * Открытку целиком рисует канва, поэтому проверять разметку бессмысленно: в jsdom её нет вовсе.
 * Вместо этого контекст подменён записывающей заглушкой — так видно ровно то, что увидит человек:
 * какие строки легли на картинку и сколько корешков нарисовано.
 */
const drawn: { texts: string[]; fills: string[]; rects: number } = { texts: [], fills: [], rects: 0 };

const stubContext = () =>
  ({
    setTransform: () => undefined,
    clearRect: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    clip: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    roundRect: () => {
      drawn.rects += 1;
    },
    fill: () => {
      drawn.fills.push(String(context.fillStyle));
    },
    fillText: (text: string) => {
      drawn.texts.push(text);
    },
    measureText: (text: string) => ({ width: text.length * 7 }),
    set fillStyle(value: string) {
      fillStyleValue = value;
    },
    get fillStyle() {
      return fillStyleValue;
    },
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  }) as unknown as CanvasRenderingContext2D;

let fillStyleValue = '';
let context: CanvasRenderingContext2D;

const review: YearInReview = {
  year: 2026,
  finishedCount: 7,
  pageCount: 1326,
  readingDays: 118,
  longestStreak: 12,
  topRated: [
    { itemId: '1', title: 'Пикник на обочине', rating: 10 },
    { itemId: '2', title: 'Disco Elysium', rating: 10 }
  ],
  kindBreakdown: { BOOK: 3, GAME: 1, MANGA: 1, MOVIE: 1, SERIES: 1 }
} as YearInReview;

const renderCard = (props: Partial<React.ComponentProps<typeof YearCard>> = {}) =>
  render(
    <App>
      <YearCard review={review} username="verifier" {...props} />
    </App>
  );

describe('YearCard', () => {
  beforeEach(() => {
    drawn.texts = [];
    drawn.fills = [];
    drawn.rects = 0;
    fillStyleValue = '';
    context = stubContext();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as never;
  });

  it('рисует год, три числа и итоговую строку', async () => {
    renderCard();

    await waitFor(() => expect(drawn.texts).toContain('Год в обзоре'));
    expect(drawn.texts).toContain('2026');
    // Intl разделяет разряды неразрывным пробелом — на открытке число не должно разрываться.
    expect(drawn.texts).toEqual(
      expect.arrayContaining(['7', 'книг', '1\u00a0326', 'страниц', '118', 'дней с чтением'])
    );
    expect(drawn.texts.join(' ')).toContain('Лучшее за год — Пикник на обочине и Disco Elysium.');
    expect(drawn.texts.join(' ')).toContain('12 дней подряд');
  });

  /** Адрес страницы — половина смысла открытки: без него её некуда отнести. */
  it('подписывает открытку адресом публичной страницы', async () => {
    renderCard();

    await waitFor(() => expect(drawn.texts.some((text) => text.includes('/u/verifier'))).toBe(true));
  });

  /**
   * Цвет вида «книга» в бренде совпадает с чернильным фоном открытки, поэтому корешки лежат
   * на бумажной подложке. Проверяем именно её: без подложки самая большая доля исчезала.
   */
  it('кладёт корешковую полосу на бумажную подложку', async () => {
    renderCard();

    await waitFor(() => expect(drawn.fills).toContain('#1B2A4A'));
    const track = drawn.fills.lastIndexOf('#FBF8F3');
    expect(track).toBeGreaterThan(-1);
    expect(drawn.fills.slice(track)).toEqual(
      expect.arrayContaining(['#1B2A4A', '#3C7A5A', '#A6446B', '#B4552A', '#B8862B'])
    );
  });

  it('копирует ссылку на публичную страницу', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /Скопировать ссылку/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/u/verifier`));
  });

  /** Без логина делиться нечем — кнопка ссылки не должна обещать несуществующий адрес. */
  it('без логина не предлагает ссылку', async () => {
    renderCard({ username: undefined });

    await waitFor(() => expect(drawn.texts).toContain('Год в обзоре'));
    expect(screen.queryByRole('button', { name: /Скопировать ссылку/ })).not.toBeInTheDocument();
  });
});
