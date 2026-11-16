import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useAdminStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      accents: {
        ok: token.colorSuccess,
        warn: token.colorWarning,
        danger: token.colorError,
        info: token.colorInfo
      },
      /** Сводка состояния: четыре показателя отвечают «всё ли в порядке» без открытия вкладок. */
      health: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 18
      } as CSSProperties,
      healthTile: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      } as CSSProperties,
      dot: (color: string): CSSProperties => ({
        display: 'inline-block',
        width: 10,
        height: 10,
        marginTop: 6,
        borderRadius: '50%',
        flexShrink: 0,
        background: color,
        boxShadow: `0 0 0 4px ${color}22`
      }),
      healthLabel: {
        display: 'block',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.4
      } as CSSProperties,
      healthValue: { display: 'block', fontSize: 18, fontWeight: 700, marginTop: 3 } as CSSProperties,
      healthHint: { display: 'block', fontSize: 12, marginTop: 2 } as CSSProperties,
      card: {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: '20px 22px'
      } as CSSProperties,
      cardHead: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16
      } as CSSProperties,
      columns: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16
      } as CSSProperties,
      node: {
        padding: '14px 16px',
        borderRadius: token.borderRadius,
        background: token.colorFillQuaternary,
        cursor: 'pointer'
      } as CSSProperties,
      nodeHead: { display: 'flex', alignItems: 'center', gap: 10 } as CSSProperties,
      meters: {
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 12
      } as CSSProperties,
      meterLabel: { fontSize: 12, display: 'block', marginBottom: 2 } as CSSProperties,
      listRow: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      fileIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: token.borderRadius,
        flexShrink: 0,
        background: token.colorFillQuaternary,
        color: token.colorTextSecondary
      } as CSSProperties,
      danger: {
        marginTop: 14,
        padding: 12,
        borderRadius: token.borderRadius,
        background: token.colorErrorBg,
        color: token.colorErrorText,
        fontSize: 12,
        lineHeight: 1.55
      } as CSSProperties,
      note: {
        padding: '13px 14px',
        borderRadius: token.borderRadius,
        background: token.colorFillQuaternary,
        fontSize: 12,
        lineHeight: 1.55
      } as CSSProperties,
      /** Подпись группы полей: макет ведёт человека по разделам, а не по одной длинной форме. */
      groupLabel: {
        display: 'block',
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: token.colorPrimary,
        marginBottom: 10
      } as CSSProperties,
      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      tag: { fontWeight: 600, borderRadius: 999, paddingInline: 10 } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      searchIcon: { color: token.colorTextTertiary } as CSSProperties,
      numeric: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      fullWidth: { width: '100%' } as CSSProperties,
      alert: { marginBottom: 16 } as CSSProperties,
      toolbar: {
        padding: 12,
        marginBottom: 16,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      } as CSSProperties,
      mobileList: { width: '100%' } as CSSProperties,
      mobileCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 14,
        background: token.colorBgContainer
      } as CSSProperties,
      mobileHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8
      } as CSSProperties,
      mobileFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap'
      } as CSSProperties,
      empty: {
        padding: '32px 24px',
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px dashed ${token.colorBorder}`
      } as CSSProperties
    }),
    [token]
  );
};
