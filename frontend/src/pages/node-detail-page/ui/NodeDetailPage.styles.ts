import { useMemo } from 'react';
import { theme } from 'antd';

export const useNodeDetailPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      container: {
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
      memoryCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: 16,
        background: token.colorBgLayout
      },
      memoryItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      },
      memoryItemLast: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0'
      },
      memoryLabel: {
        color: token.colorTextSecondary
      },
      memoryValue: {
        fontWeight: 600,
        fontFamily: 'monospace'
      },
      backButton: {
        marginBottom: 16
      },
      headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: 12
      },
      v8Section: {
        marginTop: 16
      }
    }),
    [token]
  );
};
