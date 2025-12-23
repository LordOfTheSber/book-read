import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

interface BooksTableWidgetStyles {
  toolbar: CSSProperties;
  fullWidth: CSSProperties;
  formPadding: CSSProperties;
}

export const useBooksTableWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 18,
        gap: 12
      },
      fullWidth: {
        width: '100%'
      },
      formPadding: {
        paddingTop: 4
      }
    } satisfies BooksTableWidgetStyles),
    [token]
  );
};
