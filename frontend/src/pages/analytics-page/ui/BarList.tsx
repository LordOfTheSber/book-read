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
  /** База для процентов; если не задана — берётся максимум по списку. */
  total?: number;
  emptyText?: string;
}

/**
 * Ранжированный список с горизонтальными полосами — читается быстрее таблицы
 * из двух колонок и не требует библиотеки графиков.
 */
export const BarList: React.FC<Props> = ({ items, total, emptyText = 'Данных пока нет' }) => {
  const { token } = theme.useToken();
  const visible = items.filter((item) => item.value > 0);

  if (visible.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const base = total && total > 0 ? total : Math.max(...visible.map((item) => item.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {visible.map((item) => {
        const share = base > 0 ? Math.round((item.value / base) * 100) : 0;
        const color = item.color || token.colorPrimary;

        return (
          <div key={item.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <Typography.Text ellipsis={{ tooltip: item.label }} style={{ minWidth: 0 }}>
                {item.label}
              </Typography.Text>
              <Typography.Text style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>{item.value}</span>
                <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                  {share}%
                </Typography.Text>
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
          </div>
        );
      })}
    </div>
  );
};
