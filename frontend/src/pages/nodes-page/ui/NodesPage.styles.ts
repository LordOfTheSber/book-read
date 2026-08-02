import { useMemo } from 'react';
import { theme } from 'antd';

export const useNodesPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      card: {
        border: 'none',
        borderRadius: 14,
        boxShadow: token.boxShadow,
        background: token.colorBgContainer
      },
      cardHead: {
        padding: '14px 18px',
        fontSize: 18,
        fontWeight: 600
      },
      cardBody: {
        padding: 18
      },
      tableWrapper: {
        overflowX: 'auto' as const
      },
      mobileList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12
      },
      mobileCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: 12,
        boxShadow: token.boxShadowTertiary,
        background: token.colorBgContainer,
        marginBottom: 16
      },
      mobileHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'flex-start'
      },
      mobileMeta: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4
      }
    }),
    [token]
  );
};
