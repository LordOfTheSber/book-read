import React from 'react';
import { Empty, Typography, theme } from 'antd';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface Props {
  items: BarListItem[];
  /**
   * База для долей. Задана — полосы и проценты считаются от неё: разрез, который делит
   * библиотеку, должен говорить о библиотеке. Не задана — процентов нет вовсе, а полосы
   * меряются лидером списка: доля одного автора в тысяче записей — это доли процента,
   * и полоса при такой базе перестаёт быть полосой.
   */
  total?: number;
  /**
   * Переход к записям среза. Если задан, строка становится кнопкой: у разреза аналитики
   * должен быть выход к самим книгам, иначе это тупик с числом.
   */
  onSelect?: (item: BarListItem) => void;
  emptyText?: string;
}

/**
 * Ранжированный список с горизонтальными полосами — читается быстрее таблицы
 * из двух колонок и не требует библиотеки графиков.
 */
export const BarList: React.FC<Props> = ({ items, total, onSelect, emptyText = 'Данных пока нет' }) => {
  const { token } = theme.useToken();
  const visible = items.filter((item) => item.value > 0);

  if (visible.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const relative = Boolean(total && total > 0);
  const base = relative ? (total as number) : Math.max(...visible.map((item) => item.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {visible.map((item) => {
        const share = base > 0 ? Math.round((item.value / base) * 100) : 0;
        const color = item.color || token.colorPrimary;
        const Row = onSelect ? 'button' : 'div';

        return (
          <Row
            key={item.key}
            type={onSelect ? 'button' : undefined}
            className={onSelect ? 'app-shell-reset' : undefined}
            onClick={onSelect ? () => onSelect(item) : undefined}
            aria-label={onSelect ? `${item.label}: открыть в библиотеке` : undefined}
            style={{ display: 'block', width: '100%', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <Typography.Text ellipsis={{ tooltip: item.label }} style={{ minWidth: 0 }}>
                {item.label}
              </Typography.Text>
              <Typography.Text style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>{item.value}</span>
                {relative && (
                  <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                    {share}%
                  </Typography.Text>
                )}
              </Typography.Text>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 8,
                borderRadius: 999,
                background: token.colorFillQuaternary,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.max(share, 2)}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: color,
                  transition: 'width .3s ease'
                }}
              />
            </div>
          </Row>
        );
      })}
    </div>
  );
};
