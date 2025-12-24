import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

interface BooksTableWidgetStyles {
  toolbar: CSSProperties;
  searchInput: CSSProperties;
  tableSurface: CSSProperties;
  headerRow: CSSProperties;
  drawerForm: CSSProperties;
  drawerFooter: CSSProperties;
}

export const useBooksTableWidgetStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        gap: 12
      },
      searchInput: {
        maxWidth: 360
      },
      tableSurface: {
        background: token.colorBgContainer,
        borderRadius: 12,
        boxShadow: token.boxShadowSecondary,
        padding: 8,
        border: `1px solid ${token.colorBorderSecondary}`
      },
      headerRow: {
        background: token.colorFillTertiary
      },
      drawerForm: {
        paddingTop: token.paddingXS,
        display: 'grid',
        gap: 18,
        gridTemplateColumns: '1fr'
      },
      drawerFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        padding: `${token.paddingXS}px ${token.paddingLG}px ${token.paddingLG}px`
      }
    } satisfies BooksTableWidgetStyles),
    [token]
  );
};
