import { useMemo } from 'react';
import { theme } from 'antd';

export const useTypesPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      cardBody: { padding: 24 },
      cardStyle: { boxShadow: token.boxShadow, borderRadius: 12 }
    }),
    [token]
  );
};
