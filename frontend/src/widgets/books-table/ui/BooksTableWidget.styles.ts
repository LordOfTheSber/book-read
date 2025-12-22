import { useMemo } from 'react';
import { theme } from 'antd';

export const useBooksTableWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18
      },
      infoText: {
        color: token.colorTextSecondary
      },
      fullWidth: {
        width: '100%'
      },
      formPadding: {
        paddingTop: 4
      }
    }),
    [token]
  );
};
