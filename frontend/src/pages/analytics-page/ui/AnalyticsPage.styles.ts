import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useAnalyticsPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      page: {
        maxWidth: 1440,
        margin: '0 auto',
        width: '100%'
      } as CSSProperties,
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
      emptyBody: { padding: '48px 24px' } as CSSProperties
    }),
    [token]
  );
};
