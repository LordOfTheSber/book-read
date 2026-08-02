import React from 'react';
import { Skeleton, Typography, theme } from 'antd';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Цвет акцента (иконка + полоса активного состояния). */
  accent?: string;
  active?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * Компактная плитка-метрика. Если передан onClick — работает как фильтр-чип
 * (клик по «Читаю» фильтрует список), поэтому рендерится кнопкой.
 */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  icon,
  accent,
  active = false,
  loading = false,
  onClick
}) => {
  const { token } = theme.useToken();
  const color = accent || token.colorPrimary;
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? active : undefined}
      style={{
        appearance: 'none',
        textAlign: 'left',
        font: 'inherit',
        flex: '1 1 150px',
        minWidth: 140,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${active ? color : token.colorBorderSecondary}`,
        background: active ? `${color}14` : token.colorBgContainer,
        boxShadow: active ? `inset 0 0 0 1px ${color}` : 'none',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color .16s ease, background .16s ease, transform .16s ease'
      }}
    >
      {icon && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: token.borderRadius,
            background: `${color}1f`,
            color,
            fontSize: 16
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ minWidth: 0 }}>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}
        >
          {label}
        </Typography.Text>
        {loading ? (
          <Skeleton.Button active size="small" style={{ width: 56, height: 22, marginTop: 4 }} />
        ) : (
          <Typography.Text style={{ display: 'block', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
            {value}
          </Typography.Text>
        )}
        {hint && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Typography.Text>
        )}
      </span>
    </button>
  );
};
