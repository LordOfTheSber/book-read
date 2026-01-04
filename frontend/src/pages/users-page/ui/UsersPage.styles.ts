import { useMemo } from 'react';
import { theme } from 'antd';

export const useUsersPageStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      pageContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 16
      },
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
      settingsForm: {
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: 12,
        alignItems: 'flex-end'
      },
      tableWrapper: {
        overflowX: 'auto'
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
        marginBottom: 4
      },
      mobileHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center'
      },
      mobileMeta: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
        minWidth: 0
      },
      mobileActions: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap' as const
      }
    }),
    [isMobile, token]
  );
};
