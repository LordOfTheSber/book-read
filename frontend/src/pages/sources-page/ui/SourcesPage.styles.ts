import { useMemo } from 'react';
import { theme } from 'antd';

export const useSourcesPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      cardBody: { padding: 24 },
      cardHead: { padding: '16px 24px', fontSize: 20, fontWeight: 600 },
      cardStyle: { boxShadow: token.boxShadow, borderRadius: 16, border: 'none', background: token.colorBgLayout }
    }),
    [token]
  );
};
