import { useMemo } from 'react';
import { theme } from 'antd';

export const usePageLayoutStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      layout: { minHeight: '100vh' },
      headerContent: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingInline: 16
      },
      headerExtra: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: token.colorWhite
      },
      content: { padding: '24px' }
    }),
    [token]
  );
};
