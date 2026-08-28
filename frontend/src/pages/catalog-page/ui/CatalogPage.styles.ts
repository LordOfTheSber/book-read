import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useCatalogStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      /** Рельс сущностей слева и содержимое справа; на телефоне рельс превращается в чипы. */
      layout: (withRail: boolean): CSSProperties => ({
        display: 'grid',
        gridTemplateColumns: withRail ? '240px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start'
      }),
      rail: {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 8
      } as CSSProperties,
      railItem: (active: boolean): CSSProperties => ({
        width: '100%',
        appearance: 'none',
        border: 'none',
        font: 'inherit',
        textAlign: 'left',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        borderRadius: token.borderRadius,
        cursor: 'pointer',
        background: active ? token.controlItemBgActive : 'transparent',
        color: active ? token.colorPrimary : token.colorText,
        fontWeight: active ? 600 : 400
      }),
      railCount: (active: boolean): CSSProperties => ({
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        color: active ? token.colorPrimary : token.colorTextSecondary
      }),
      toolbar: {
        display: 'flex',
        gap: 12,
        marginBottom: 14,
        flexWrap: 'wrap'
      } as CSSProperties,
      cards: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16
      } as CSSProperties,
      card: {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: '18px 20px'
      } as CSSProperties,
      cardHead: { display: 'flex', alignItems: 'center', gap: 13 } as CSSProperties,
      cardName: {
        display: 'block',
        fontWeight: 600,
        fontSize: 16,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      } as CSSProperties,
      cardMeta: { display: 'block', fontSize: 12, marginTop: 2 } as CSSProperties,
      covers: { marginTop: 16, display: 'flex', gap: 8 } as CSSProperties,
      /** Непрочитанное приглушено: стопка обложек показывает не состав, а пройденное. */
      cover: (read: boolean): CSSProperties => ({ flex: 1, minWidth: 0, opacity: read ? 1 : 0.45 }),
      coversMore: {
        flex: 1,
        minWidth: 0,
        height: 84,
        borderRadius: token.borderRadius,
        border: `1px dashed ${token.colorBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: token.colorTextSecondary
      } as CSSProperties,
      cardFoot: {
        marginTop: 14,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      } as CSSProperties,
      table: {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden'
      } as CSSProperties,
      tableHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 44,
        padding: '0 16px',
        background: token.colorFillQuaternary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: token.colorTextSecondary
      } as CSSProperties,
      row: (last: boolean, editing: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '11px 16px',
        background: editing ? token.controlItemBgHover : 'transparent',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      rowActions: { width: 76, display: 'flex', justifyContent: 'flex-end', gap: 4 } as CSSProperties,
      numeric: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      muted: { color: token.colorTextSecondary } as CSSProperties,
      hint: { fontSize: 12, color: token.colorTextSecondary } as CSSProperties,
      rating: { display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 } as CSSProperties,
      ratingIcon: { color: token.colorWarning } as CSSProperties,
      empty: {
        padding: '40px 24px',
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px dashed ${token.colorBorder}`
      } as CSSProperties,
      more: { display: 'flex', justifyContent: 'center', marginTop: 16 } as CSSProperties
    }),
    [token]
  );
};
