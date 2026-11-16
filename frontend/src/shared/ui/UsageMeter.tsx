import React from 'react';
import { Typography, theme } from 'antd';
import { usageLevel } from '@/shared/lib/format';

interface Props {
  /** 0–100; undefined — данных нет. */
  percent?: number;
  /** Подпись под шкалой, обычно «использовано / всего». */
  caption?: React.ReactNode;
  width?: number;
}

/**
 * Компактная шкала загрузки: строка «процент + полоса» и подпись.
 * В отличие от antd Progress занимает одну строку и не анимируется —
 * в таблице мониторинга десяток таких шкал в столбик.
 */
export const UsageMeter: React.FC<Props> = ({ percent, caption, width = 120 }) => {
  const { token } = theme.useToken();

  if (percent === undefined) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  const level = usageLevel(percent);
  const color =
    level === 'critical' ? token.colorError : level === 'warning' ? token.colorWarning : token.colorSuccess;

  return (
    <div style={{ minWidth: width }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text
          strong
          style={{ fontVariantNumeric: 'tabular-nums', minWidth: 42, color }}
        >
          {Math.round(percent)}%
        </Typography.Text>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: token.colorFillQuaternary,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${Math.max(percent, 2)}%`,
              height: '100%',
              borderRadius: 999,
              background: color,
              transition: 'width .3s ease'
            }}
          />
        </div>
      </div>
      {caption && (
        <Typography.Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {caption}
        </Typography.Text>
      )}
    </div>
  );
};
