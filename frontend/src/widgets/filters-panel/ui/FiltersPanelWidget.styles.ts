import { useMemo } from 'react';
import { theme } from 'antd';

export const useFiltersPanelStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      field: (minWidth: number) => ({ flex: 1, minWidth }),
      narrowField: { width: 180 },
      actions: { justifyContent: 'flex-end' as const },
      button: { minWidth: 200 },
      numberInput: { width: '100%' },
      formGap: token.marginSM ?? token.margin ?? 12
    }),
    [token]
  );
};
