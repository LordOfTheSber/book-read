import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColumnChart } from './ColumnChart';

const months = [
  { key: '2026-01', label: 'янв', value: 0 },
  { key: '2026-02', label: 'фев', value: 3 }
];

/** Полоса столбцов — единственный прокручиваемый узел графика: он же корень разметки. */
const strip = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('ColumnChart', () => {
  /**
   * Прокрутка у графика только вбок. `overflow-x: auto` при `overflow-y: visible` браузер
   * приводит к `auto` по обеим осям, и одного лишнего пикселя подписи хватало, чтобы сбоку
   * выросла вертикальная полоса прокрутки во всю высоту карточки.
   */
  it('не прокручивается по вертикали', () => {
    const { container } = render(<ColumnChart items={months} />);

    expect(strip(container)).toHaveStyle({ overflowX: 'auto', overflowY: 'hidden' });
  });

  /**
   * Интерлиньяж подписи задан под её же высоту: у 11 пунктов он по умолчанию 17,3, и строка
   * вылезала из своей коробки — те самые лишние пиксели.
   */
  it('держит подпись в отведённой ей высоте', () => {
    render(<ColumnChart items={months} />);

    expect(screen.getByText('фев')).toHaveStyle({ height: '16px', lineHeight: '16px' });
  });

  /** Пустой период — это «здесь ничего», а не обрыв графика: столбец остаётся видимой чертой. */
  it('рисует столбец и там, где ничего не было', () => {
    const { container } = render(<ColumnChart items={months} />);

    expect(strip(container).children).toHaveLength(2);
  });

  /** Вторая серия включается сама, как только у столбцов появляется прошлое значение. */
  it('со сравнением рисует два столбца на период', () => {
    const { container } = render(
      <ColumnChart items={months.map((month) => ({ ...month, compare: 1 }))} />
    );

    // Столбец → область столбцов → сами столбцы: два периода по паре «прошлый — нынешний».
    const bars = strip(container).querySelectorAll(':scope > div > div > div');
    expect(bars).toHaveLength(4);
  });

  it('без данных показывает заглушку, а не пустую полосу', () => {
    render(<ColumnChart items={[]} emptyText="Дочитанного пока нет" />);

    expect(screen.getByText('Дочитанного пока нет')).toBeInTheDocument();
  });
});
