import { useMemo } from 'react';
import { theme } from 'antd';

export const useTypesManagerWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: { marginBottom: 18 },
      table: {
        background: token.colorBgContainer ?? '#ffffff',
        borderRadius: 12,
        boxShadow: token.boxShadowSecondary,
        padding: 8,
        border: `1px solid ${token.colorBorderSecondary}`
      },
      headerRow: { background: token.colorFillTertiary },
      modal: { paddingTop: token.paddingXS ?? 8 }
    }),
    [token]
  );
};
