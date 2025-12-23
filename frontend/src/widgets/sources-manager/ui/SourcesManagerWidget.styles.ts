import { useMemo } from 'react';
import { theme } from 'antd';

export const useSourcesManagerWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: { marginBottom: 18 },
      table: { background: token.colorBgContainer ?? '#ffffff' },
      modal: { paddingTop: token.paddingXS ?? 8 }
    }),
    [token]
  );
};
