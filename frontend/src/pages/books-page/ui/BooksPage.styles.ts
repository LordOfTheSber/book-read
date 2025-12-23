import { useMemo } from 'react';
import { theme } from 'antd';

export const useBooksPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      pageCard: {
        border: 'none',
        borderRadius: 16,
        boxShadow: token.boxShadow,
        background: token.colorBgLayout
      },
      pageHead: {
        padding: '16px 24px',
        fontSize: 20,
        fontWeight: 600
      },
      pageBody: {
        padding: 24
      },
      contentWrapper: {
        gap: 24
      },
      heroCard: {
        background: token.colorBgContainer,
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        padding: 18
      },
      heroTitle: {
        marginTop: 0,
        marginBottom: 8
      },
      heroDescription: {
        marginBottom: 18,
        color: token.colorTextSecondary
      },
      filtersCard: {
        background: token.colorBgContainer,
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        padding: 0,
        position: 'sticky' as const,
        top: 24,
        maxWidth: 340,
        minWidth: 300
      },
      filtersCardBodyStyle: { padding: 0 },
      filtersCardBody: {
        padding: 18
      },
      filtersTitle: {
        marginTop: 0,
        marginBottom: 8
      },
      filtersDescription: {
        marginBottom: 18,
        color: token.colorTextSecondary
      }
    }),
    [token]
  );
};
