import React from 'react';
import { Empty, Tooltip, Typography, theme } from 'antd';

export interface ColumnChartItem {
  key: string;
  /** Подпись под столбцом. */
  label: string;
  value: number;
  tooltip?: React.ReactNode;
}

interface Props {
  items: ColumnChartItem[];
  /** Высота области столбцов без подписей. */
  height?: number;
  color?: string;
  emptyText?: string;
  /**
   * Подписывать каждый n-й столбец. Двадцать четыре месяца подряд подписями не помещаются,
   * а прореживать их в самом графике проще, чем подбирать угол наклона текста.
   */
  labelEvery?: number;
}

/**
 * Столбчатый график по периодам. В отличие от {@link BarList} показывает и пустые периоды:
 * провал в ряду — это тоже результат, и выбросить нули значило бы нарисовать ровную картину
 * там, где её нет.
 * <p>
 * Как и {@link BarList}, обходится без библиотеки графиков: столбцы — это div с высотой в
 * процентах, и ради них тянуть в сборку ещё одну зависимость незачем.
 */
export const ColumnChart: React.FC<Props> = ({
  items,
  height = 90,
  color,
  emptyText = 'Данных пока нет',
  labelEvery = 1
}) => {
  const { token } = theme.useToken();

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const max = Math.max(...items.map((item) => item.value), 0);
  const barColor = color || token.colorPrimary;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto' }}>
      {items.map((item, index) => {
        const share = max > 0 ? item.value / max : 0;
        const showLabel = index % labelEvery === 0;

        return (
          <Tooltip key={item.key} title={item.tooltip ?? `${item.label}: ${item.value}`}>
            <div style={{ flex: '1 1 0', minWidth: 8, textAlign: 'center' }}>
              <div style={{ height, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    // Нулевой столбец остаётся видимой чертой: пустой период должен читаться
                    // как «здесь ничего», а не как обрыв графика.
                    height: `${Math.max(share * 100, item.value > 0 ? 6 : 2)}%`,
                    borderRadius: 4,
                    background: item.value > 0 ? barColor : token.colorFillSecondary,
                    transition: 'height .3s ease'
                  }}
                />
              </div>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, display: 'block', whiteSpace: 'nowrap' }}
              >
                {showLabel ? item.label : ' '}
              </Typography.Text>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
};
