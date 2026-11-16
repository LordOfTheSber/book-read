import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

/**
 * Раскладка «Выписок» по макетам `Quotes1.dc.html` (стена) и `Quotes2.dc.html` (по книгам).
 */
export const useQuotesPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 } as CSSProperties,
      search: { flex: '1 1 320px', minWidth: 220 } as CSSProperties,
      /**
       * Кладка в три колонки: цитаты разной длины, и в ряду одинаковой высоты короткая
       * растягивалась бы пустотой на высоту длинной.
       */
      wall: { columnWidth: 320, columnGap: 16 } as CSSProperties,
      wallCard: { breakInside: 'avoid', marginBottom: 16, background: token.colorBgContainer } as CSSProperties,
      quoteText: {
        marginBottom: 12,
        paddingInlineEnd: 20,
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 1.55,
        whiteSpace: 'pre-line'
      } as CSSProperties,
      /** Подвал карточки: обложка, книга и когда записано — отделены чертой от самой цитаты. */
      quoteFooter: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      /** Две колонки: слева книги, справа цитаты выбранной. */
      byBook: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start'
      } as CSSProperties,
      byBookNarrow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 } as CSSProperties,
      booksCard: {
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      booksBody: { padding: 12 } as CSSProperties,
      bookRow: (active: boolean): CSSProperties => ({
        width: '100%',
        appearance: 'none',
        font: 'inherit',
        textAlign: 'left',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 10px',
        borderRadius: token.borderRadius,
        cursor: 'pointer',
        background: active ? alpha(token.colorPrimary, 0.1) : 'transparent'
      }),
      bookCount: (active: boolean): CSSProperties => ({
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        color: active ? token.colorPrimary : token.colorTextSecondary
      }),
      /** Шапка выбранной книги: обложка, название, счётчики и два действия. */
      bookHeader: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 18,
        marginBottom: 14,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      bookHeaderBody: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 18,
        padding: '20px 24px',
        width: '100%'
      } as CSSProperties,
      /** Номер страницы — плашка слева от цитаты: по ним и листают выписки одной книги. */
      page: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 62,
        height: 26,
        padding: '0 10px',
        borderRadius: 999,
        background: token.colorFillQuaternary,
        color: token.colorTextSecondary,
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      /** Цитата в колонке книги — с полосой слева: она читается абзацем, а не карточкой. */
      quoteBar: {
        paddingLeft: 14,
        borderLeft: `3px solid ${alpha(token.colorPrimary, 0.35)}`,
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 1.6,
        whiteSpace: 'pre-line',
        marginBottom: 0
      } as CSSProperties,
      quoteRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 20px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        marginBottom: 12
      } as CSSProperties
    }),
    [token]
  );
};
