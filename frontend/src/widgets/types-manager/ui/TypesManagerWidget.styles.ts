import { useMemo } from 'react';
import { theme } from 'antd';

export const useTypesManagerWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: { marginBottom: 18 },
      table: { background: token.colorBgContainer },
      modal: { paddingTop: token.paddingXS }
    }),
    [token]
  );
};
