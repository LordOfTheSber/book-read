import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

export const useNodeDetailPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      backLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12
      } as CSSProperties,
      stats: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20
      } as CSSProperties,
      /** Четыре плитки состояния в ряд — по макету; на узком экране перестраиваются сами. */
      tiles: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12,
        marginBottom: 18
      } as CSSProperties,
      tile: { borderRadius: token.borderRadiusLG, borderColor: token.colorBorderSecondary } as CSSProperties,
      tileBody: { padding: '16px 18px' } as CSSProperties,
      tileHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 } as CSSProperties,
      tileLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 } as CSSProperties,
      tileBadge: (color: string): CSSProperties => ({
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: alpha(color, 0.12),
        color
      }),
      tileValue: {
        marginTop: 8,
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      tileBar: {
        marginTop: 10,
        height: 6,
        borderRadius: 999,
        background: token.colorFillSecondary,
        overflow: 'hidden'
      } as CSSProperties,
      tileBarFill: (percent: number, color: string): CSSProperties => ({
        display: 'block',
        width: `${Math.max(2, Math.min(100, percent))}%`,
        height: '100%',
        borderRadius: 999,
        background: color,
        transition: 'width .3s ease'
      }),
      tileHint: { display: 'block', marginTop: 8, fontSize: 12 } as CSSProperties,
      /** Слева формы узла, справа вкладки: настройки пинга общие и не должны прятаться внутри. */
      columns: {
        display: 'grid',
        gridTemplateColumns: '380px minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start'
      } as CSSProperties,
      columnsNarrow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 } as CSSProperties,
      side: { display: 'flex', flexDirection: 'column', gap: 14 } as CSSProperties,
      aboutRow: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        fontWeight: 500
      } as CSSProperties,
      alert: { marginBottom: 16 } as CSSProperties,
      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      meterBlock: { marginBottom: 16 } as CSSProperties,
      sectionTitle: { marginTop: 20, marginBottom: 8 } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      tabularNumbers: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      accents: {
        ok: token.colorSuccess,
        warning: token.colorWarning,
        error: token.colorError,
        uptime: token.colorInfo
      }
    }),
    [token]
  );
};
