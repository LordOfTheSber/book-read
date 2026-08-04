import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useBooksListStyles = () => {
  const { token } = theme.useToken();

  return useMemo(() => {
    const muted: CSSProperties = { color: token.colorTextTertiary };

    return {
      muted,
      mutedIcon: { color: token.colorTextQuaternary, fontSize: 16 } as CSSProperties,
      tag: { fontWeight: 600, borderRadius: 999, paddingInline: 10 } as CSSProperties,
      neutralTag: {
        borderRadius: 999,
        paddingInline: 10,
        background: token.colorFillQuaternary,
        color: token.colorTextSecondary
      } as CSSProperties,
      favoriteIcon: { color: token.colorWarning, fontSize: 16 } as CSSProperties,
      rating: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      ratingIcon: { color: token.colorWarning, fontSize: 13 } as CSSProperties,
      sourceLink: { display: 'inline-flex', alignItems: 'center', gap: 4 } as CSSProperties,

      titleCell: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as CSSProperties,
      titleRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } as CSSProperties,
      altTitle: { fontSize: 12 } as CSSProperties,

      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      tablePagination: { padding: '12px 16px', marginBottom: 0 } as CSSProperties,

      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 16, display: 'flex', flexDirection: 'column', gap: 4, height: '100%' } as CSSProperties,
      // Обложки приходят разного размера; cover фиксирует высоту, чтобы сетка не рвалась.
      cardCover: {
        width: '100%',
        height: 200,
        objectFit: 'cover',
        borderTopLeftRadius: token.borderRadiusLG,
        borderTopRightRadius: token.borderRadiusLG
      } as CSSProperties,
      progressBlock: { display: 'flex', alignItems: 'center', gap: 8 } as CSSProperties,
      advanceButton: { padding: 0, height: 'auto' } as CSSProperties,
      cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as CSSProperties,
      cardTitle: { margin: '8px 0 0', fontSize: 16, lineHeight: 1.35 } as CSSProperties,
      cardAltTitle: { margin: 0, fontSize: 12 } as CSSProperties,
      cardTags: { marginTop: 8 } as CSSProperties,
      cardFooter: {
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      } as CSSProperties,
      cardAuthor: { fontSize: 11, marginTop: 6 } as CSSProperties,

      emptyWrapper: {
        padding: '48px 24px',
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px dashed ${token.colorBorder}`
      } as CSSProperties,
      paginationBar: { display: 'flex', justifyContent: 'flex-end', marginTop: 20 } as CSSProperties
    };
  }, [token]);
};
