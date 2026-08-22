import React from 'react';
import { Empty, Tooltip, Typography, theme } from 'antd';

export interface ColumnChartItem {
  key: string;
  /**
   * Подпись под столбцом. Необязательная: какие столбцы подписывать, решает вызывающий — только
   * он знает, что на шкале в два года подписать надо январь, а не каждый третий месяц подряд.
   */
  label?: string;
  value: number;
  /**
   * Значение того же периода год назад. Если задано хоть у одного столбца, график становится
   * парным: слева бледный столбец прошлого, справа — нынешний.
   */
  compare?: number;
  tooltip?: React.ReactNode;
}

interface Props {
  items: ColumnChartItem[];
  /** Высота области столбцов без подписей. */
  height?: number;
  /**
   * Предел ширины столбца. Без него пять лет на всю карточку превращаются в пять плит: столбец
   * занимает свою долю ширины, а доля тем больше, чем меньше периодов.
   */
  maxBarWidth?: number;
  color?: string;
  emptyText?: string;
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
  maxBarWidth,
  color,
  emptyText = 'Данных пока нет'
}) => {
  const { token } = theme.useToken();

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const paired = items.some((item) => item.compare !== undefined);
  // Шкала общая для обеих серий: посчитай максимум по одной, и прошлый год вылезал бы
  // за верх графика ровно в тот момент, когда он был лучше нынешнего.
  const max = Math.max(...items.map((item) => Math.max(item.value, item.compare ?? 0)), 0);
  const barColor = color || token.colorPrimary;

  /*
   * Заданный предел ширины делает столбцы фиксированными и жмётся только на узком экране: иначе
   * пара «прошлый — нынешний» расползлась бы по половинам колонки вместо того, чтобы стоять рядом.
   */
  const barFlex = maxBarWidth ? `0 1 ${maxBarWidth}px` : '1 1 0';

  /** Нулевой столбец остаётся видимой чертой: пустой период — это «здесь ничего», а не обрыв. */
  const share = (value: number) => `${Math.max(max > 0 ? (value / max) * 100 : 0, value > 0 ? 6 : 2)}%`;

  return (
    /*
     * Прокрутка только вбок. `overflow-x: auto` при `overflow-y: visible` браузер приводит к
     * `auto` по обеим осям, и одного лишнего пикселя хватало, чтобы у графика появилась
     * вертикальная полоса прокрутки.
     */
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: paired ? 8 : 4,
        overflowX: 'auto',
        overflowY: 'hidden'
      }}
    >
      {items.map((item) => (
        <Tooltip key={item.key} title={item.tooltip ?? `${item.label ?? item.key}: ${item.value}`}>
          <div style={{ flex: '1 1 0', minWidth: paired ? 18 : 8, textAlign: 'center' }}>
            <div
              style={{
                height,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 3
              }}
            >
              {paired && (
                <div
                  style={{
                    flex: barFlex,
                    minWidth: 0,
                    height: share(item.compare ?? 0),
                    borderRadius: 4,
                    background: token.colorFillSecondary,
                    boxShadow: `inset 0 0 0 1px ${token.colorBorder}`
                  }}
                />
              )}
              <div
                style={{
                  flex: barFlex,
                  minWidth: 0,
                  height: share(item.value),
                  borderRadius: 4,
                  background: item.value > 0 ? barColor : token.colorFillSecondary,
                  transition: 'height .3s ease'
                }}
              />
            </div>
            {/* Высота задана явно: пустая подпись не должна схлопывать строку и ронять
                выравнивание соседних столбцов. Интерлиньяж — под ту же высоту: у 11 пунктов он
                по умолчанию 17,3, и строка вылезала из своей коробки. */}
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 11,
                display: 'block',
                height: 16,
                lineHeight: '16px',
                whiteSpace: 'nowrap'
              }}
            >
              {item.label}
            </Typography.Text>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};
