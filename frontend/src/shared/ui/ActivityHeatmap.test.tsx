import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityHeatmap } from './ActivityHeatmap';
import { toLocalIso } from '@/shared/lib/date';

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Среда — то есть неделя заведомо неполная с обеих сторон, и выравнивание видно.
    vi.setSystemTime(new Date(2026, 7, 12, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const cells = () => screen.getAllByTestId(/^heatmap-day-/);

  it('строит сетку из целых недель', () => {
    render(<ActivityHeatmap days={[]} window={371} />);

    expect(cells()).toHaveLength(371);
  });

  /**
   * Сетка кончается воскресеньем текущей недели. Дни после сегодняшнего в ней есть, но они
   * не должны выглядеть как дни без чтения — это ещё не наступившие дни.
   */
  it('доводит последнюю неделю до воскресенья и гасит будущие дни', () => {
    render(<ActivityHeatmap days={[]} window={371} />);

    expect(screen.getByTestId('heatmap-day-2026-08-16')).toBeInTheDocument();
    expect(screen.queryByTestId('heatmap-day-2026-08-17')).not.toBeInTheDocument();
    expect(screen.getByTestId('heatmap-day-2026-08-13')).toHaveStyle({ opacity: '0.3' });
    expect(screen.getByTestId('heatmap-day-2026-08-12')).toHaveStyle({ opacity: '1' });
  });

  /** Сервер присылает только дни с чтением — остальные клетки достраиваются пустыми. */
  it('раскладывает присланные дни по ступеням насыщенности', () => {
    render(
      <ActivityHeatmap
        days={[
          { date: '2026-08-10', minutes: 100, sessions: 3 },
          { date: '2026-08-11', minutes: 25, sessions: 1 }
        ]}
        window={371}
      />
    );

    expect(screen.getByTestId('heatmap-day-2026-08-10')).toHaveAttribute('data-level', '4');
    expect(screen.getByTestId('heatmap-day-2026-08-11')).toHaveAttribute('data-level', '1');
    expect(screen.getByTestId('heatmap-day-2026-08-09')).toHaveAttribute('data-level', '0');
  });

  /**
   * Первая неделя месяца обычно разрезана границей столбца, и признак «в неделе есть число
   * от 1 до 7» печатал подпись дважды подряд — «Окт Окт», «Янв Янв».
   */
  it('подписывает каждый месяц ровно один раз', () => {
    const { container } = render(<ActivityHeatmap days={[]} window={371} />);

    const labels = Array.from(container.querySelectorAll('.ant-typography'))
      .map((node) => node.textContent?.trim())
      .filter((text): text is string => Boolean(text));

    // Окно в 53 недели чуть длиннее года, поэтому один месяц законно встречается дважды —
    // но никогда двумя подписями подряд.
    expect(labels.length).toBeGreaterThan(10);
    labels.forEach((label, index) => {
      if (index > 0) expect(label).not.toBe(labels[index - 1]);
    });
    const counts = labels.reduce<Record<string, number>>((acc, label) => {
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  /**
   * Локальная дата, а не UTC: через `toISOString` вся сетка съезжала бы на день у всех
   * западнее Гринвича.
   */
  it('совмещает клетку сегодняшнего дня с локальной датой', () => {
    render(<ActivityHeatmap days={[]} window={371} />);

    expect(screen.getByTestId(`heatmap-day-${toLocalIso(new Date())}`)).toBeInTheDocument();
  });
});
