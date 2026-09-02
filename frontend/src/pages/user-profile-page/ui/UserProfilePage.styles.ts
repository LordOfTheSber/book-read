import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

/**
 * Раскладка чужой страницы по макету `PublicPage.dc.html`: шапка, вкладки и две колонки, где
 * отзывы — главное содержимое, а числа, полки и «сейчас читает» сжаты в правую.
 */
export const useUserProfilePageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      header: {
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 20,
        padding: '22px 24px',
        marginBottom: 16,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      } as CSSProperties,
      name: { margin: 0, fontSize: 24, lineHeight: 1.2, letterSpacing: -0.3 } as CSSProperties,
      bio: { marginTop: 10, marginBottom: 0, maxWidth: 620, lineHeight: 1.55 } as CSSProperties,
      counters: { marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontSize: 13 } as CSSProperties,
      columns: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: 16,
        alignItems: 'start'
      } as CSSProperties,
      columnsNarrow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 } as CSSProperties,
      side: { display: 'flex', flexDirection: 'column', gap: 14 } as CSSProperties,
      card: {
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: '18px 20px' } as CSSProperties,
      /** Четыре числа сеткой 2×2: в столбик они занимали бы всю высоту колонки. */
      stats: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 } as CSSProperties,
      statLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        display: 'block'
      } as CSSProperties,
      statValue: {
        display: 'block',
        marginTop: 4,
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.2,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      shelfRow: {
        width: '100%',
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        font: 'inherit',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '6px 0',
        cursor: 'pointer'
      } as CSSProperties,
      shelfIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: token.borderRadius,
        flexShrink: 0,
        background: alpha(token.colorPrimary, 0.1),
        color: token.colorPrimary
      } as CSSProperties,
      covers: { display: 'flex', gap: 10, flexWrap: 'wrap' } as CSSProperties,
      /** Карточка отзыва: обложка слева, текст справа — как в ленте, но без строки автора. */
      review: {
        marginBottom: 14,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      reviewBody: { display: 'flex', gap: 16, padding: '20px 22px' } as CSSProperties,
      reviewTitleRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 } as CSSProperties,
      reviewText: { marginTop: 11, marginBottom: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' } as CSSProperties,
      /** Отметка «есть у вас» — то, ради чего вообще ходят к чужому профилю. */
      owned: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 10px',
        borderRadius: 999,
        background: alpha(token.colorSuccess, 0.12),
        color: token.colorSuccessText,
        fontSize: 12,
        fontWeight: 600
      } as CSSProperties,
      actions: { marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 } as CSSProperties,
      thread: {
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties
    }),
    [token]
  );
};
