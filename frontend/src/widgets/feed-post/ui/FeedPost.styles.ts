import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useFeedPostStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      card: {
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      body: { padding: '20px 22px' } as CSSProperties,
      /** Мелкое событие — одна строка: с отзывами оно спорить не должно. */
      lineBody: { padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 } as CSSProperties,
      head: { display: 'flex', alignItems: 'center', gap: 11 } as CSSProperties,
      headText: { flex: 1, minWidth: 0 } as CSSProperties,
      time: { display: 'block', fontSize: 12, marginTop: 2 } as CSSProperties,
      rating: { display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 } as CSSProperties,
      bodyRow: { marginTop: 16, display: 'flex', gap: 16 } as CSSProperties,
      /** На телефоне обложка встаёт над текстом: рядом с ней остаётся полстроки. */
      bodyColumn: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties,
      text: { flex: 1, minWidth: 0 } as CSSProperties,
      title: { fontSize: 16, fontWeight: 600, display: 'block' } as CSSProperties,
      meta: { display: 'block', fontSize: 13, marginTop: 3 } as CSSProperties,
      review: { marginTop: 12, marginBottom: 12, lineHeight: 1.6 } as CSSProperties,
      spoiler: {
        marginTop: 10,
        marginBottom: 0,
        padding: '10px 13px',
        borderRadius: token.borderRadius,
        background: token.colorFillQuaternary,
        lineHeight: 1.6
      } as CSSProperties,
      actions: {
        marginTop: 16,
        paddingTop: 14,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      thread: {
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      lineText: { flex: 1, minWidth: 0, lineHeight: 1.5 } as CSSProperties,
      lineTime: { fontSize: 12, flexShrink: 0 } as CSSProperties
    }),
    [token]
  );
};
