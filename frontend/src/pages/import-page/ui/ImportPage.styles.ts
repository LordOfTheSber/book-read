import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

/**
 * Раскладка импорта по макету `Import2.dc.html`: источники сверху, таблица слева, разбор файла
 * и колонки — в правой колонке, чтобы таблица не тонула в подсказках.
 */
export const useImportPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      sources: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 20
      } as CSSProperties,
      /** Найденный источник обведён: файл сам говорит, откуда он, — выбирать его руками незачем. */
      source: (active: boolean): CSSProperties => ({
        padding: '16px 18px',
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        boxShadow: active ? `inset 0 0 0 1px ${token.colorPrimary}` : 'none'
      }),
      sourceMark: (color: string): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: token.borderRadius,
        fontSize: 12,
        fontWeight: 700,
        background: alpha(color, 0.12),
        color
      }),
      columns: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        gap: 20,
        alignItems: 'start'
      } as CSSProperties,
      columnsNarrow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 } as CSSProperties,
      card: {
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      side: { display: 'flex', flexDirection: 'column', gap: 14 } as CSSProperties,
      summaryRow: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      summaryValue: (color?: string): CSSProperties => ({
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color
      }),
      /** Колонка файла чипом: зелёное приедет, серое — нет. */
      column: (recognized: boolean): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 10px',
        borderRadius: 999,
        fontSize: 12,
        background: recognized ? alpha(token.colorSuccess, 0.12) : token.colorFillQuaternary,
        color: recognized ? token.colorSuccessText : token.colorTextSecondary
      }),
      footer: {
        marginTop: 16,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      } as CSSProperties
    }),
    [token]
  );
};
