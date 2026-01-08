import { useMemo } from 'react';
import { theme } from 'antd';

export const useBooksPageStyles = (isMobile: boolean) => {
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
        gap: 24,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-start'
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
        position: isMobile ? 'static' : ('sticky' as const),
        top: isMobile ? undefined : 24,
        maxWidth: isMobile ? '100%' : 340,
        minWidth: isMobile ? 'auto' : 300,
        width: isMobile ? '100%' : 'auto'
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
    [isMobile, token]
  );
};
