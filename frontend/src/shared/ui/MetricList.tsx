import React from 'react';
import { Typography, theme } from 'antd';

export interface MetricRow {
  key?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Моноширинный шрифт для чисел и размеров. */
  mono?: boolean;
}

/**
 * Список «подпись — значение» с разделителями. Заменяет bordered Descriptions
 * там, где нужна пара колонок без тяжёлой сетки из рамок.
 */
export const MetricList: React.FC<{ items: MetricRow[] }> = ({ items }) => {
  const { token } = theme.useToken();

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.key ?? index}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            padding: '9px 0',
            borderBottom: index === items.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`
          }}
        >
          <Typography.Text type="secondary">{item.label}</Typography.Text>
          <Typography.Text
            strong
            style={{
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: item.mono ? token.fontFamilyCode : undefined
            }}
          >
            {item.value}
          </Typography.Text>
        </div>
      ))}
    </div>
  );
};
