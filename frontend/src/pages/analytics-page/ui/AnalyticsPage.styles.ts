import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useAnalyticsPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      stats: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20
      } as CSSProperties,
      alert: { marginBottom: 20 } as CSSProperties,
      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      emptyBody: { padding: '48px 24px' } as CSSProperties,
      /** Строка сравнения под графиком: числа в ряд, с переносом на узком экране. */
      footnote: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 12,
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      hint: { marginTop: 12, marginBottom: 0 } as CSSProperties,
      /** Управление карточки, вынесенное в тело на узком экране. */
      controls: { marginBottom: 16 } as CSSProperties
    }),
    [token]
  );
};
