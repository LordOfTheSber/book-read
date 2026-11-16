import React from 'react';
import { Form } from 'antd';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RatingTab } from './RatingTab';
import { LibraryItem } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

/**
 * jsdom не считает раскладку, поэтому переполнение здесь не поймать — оно измерялось в браузере.
 * Тест сторожит то, из-за чего оно возникало: на узком экране десятизвёздочной строки быть
 * не должно, а счётчик символов не должен рисоваться отдельно от подписи.
 */
const matchWidth = (width: number) => {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
};

const item = {
  id: 'i-1',
  title: 'Задача трёх тел',
  kind: 'BOOK',
  status: 'COMPLETED',
  rating: 8.5,
  ratingPlot: 9,
  ratingStyle: 7.5,
  ratingCharacters: 8,
  ratingEnding: 6.5,
  review: 'Хорошая книга'
} as unknown as LibraryItem;

const Harness: React.FC = () => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false} layout="vertical" initialValues={item}>
      <RatingTab item={item} form={form} />
    </Form>
  );
};

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

describe('RatingTab', () => {
  /** Десять звёзд с половинками — 312 неразрывных пикселей: на телефоне они уезжали за край. */
  it('на телефоне даёт ползунки вместо звёзд', () => {
    matchWidth(360);
    const { container } = renderWithStore(<Harness />);

    expect(container.querySelector('.ant-rate')).toBeNull();
    // Общая оценка плюс четыре критерия.
    expect(screen.getAllByRole('slider')).toHaveLength(5);
    expect(screen.getByText('8,5 из 10')).toBeInTheDocument();
  });

  it('на широком экране звёзды остаются', () => {
    matchWidth(1280);
    const { container } = renderWithStore(<Harness />);

    expect(container.querySelectorAll('.ant-rate')).toHaveLength(5);
    expect(screen.queryByRole('slider')).toBeNull();
  });

  /**
   * showCount рисует счётчик там же, где стоит подпись поля, и на узком экране «35 символов»
   * ложилось поверх «Публичная часть — без спойлеров».
   */
  it('счётчик символов идёт частью подписи, а не отдельной надписью', () => {
    matchWidth(360);
    const { container } = renderWithStore(<Harness />);

    expect(screen.getByText('Публичная часть — без спойлеров · 13 символов')).toBeInTheDocument();
    expect(container.querySelector('.ant-input-data-count')).toBeNull();
  });
});
