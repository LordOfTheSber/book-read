import React from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

interface Props {
  /** Те же пресеты, что у Badge: цвет состояния один на весь интерфейс. */
  status: 'success' | 'warning' | 'error' | 'default';
  label: string;
}

/**
 * Состояние чипом: точка и слово на бумажной заливке.
 *
 * От `Badge` отличается тем, что читается издалека и не теряется рядом с крупным заголовком:
 * точка в четыре пикселя возле тридцатипиксельного имени узла не воспринимается как состояние.
 */
export const StatusDot: React.FC<Props> = ({ status, label }) => {
  const { token } = theme.useToken();
  const color =
    status === 'success'
      ? token.colorSuccess
      : status === 'warning'
        ? token.colorWarning
        : status === 'error'
          ? token.colorError
          : token.colorTextQuaternary;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 26,
        padding: '0 12px',
        borderRadius: 999,
        background: alpha(color, 0.12),
        color,
        fontSize: 13,
        fontWeight: 600
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
};
