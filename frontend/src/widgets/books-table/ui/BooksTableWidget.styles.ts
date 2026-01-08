import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

interface BooksTableWidgetStyles {
  toolbar: CSSProperties;
  searchInput: CSSProperties;
  tableSurface: CSSProperties;
  headerRow: CSSProperties;
  drawerForm: CSSProperties;
  drawerFooter: CSSProperties;
  mobileList: CSSProperties;
  mobileCard: CSSProperties;
  mobileHeader: CSSProperties;
  mobileMeta: CSSProperties;
  mobileActions: CSSProperties;
}

export const useBooksTableWidgetStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: 18,
        gap: 12,
        flexDirection: isMobile ? 'column' : 'row'
      },
      searchInput: {
        maxWidth: isMobile ? '100%' : 360,
        width: '100%'
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
      },
      mobileList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      },
      mobileCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: 12,
        boxShadow: token.boxShadowTertiary,
        background: token.colorBgContainer,
        marginBottom: 16
      },
      mobileHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        alignItems: 'flex-start'
      },
      mobileMeta: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      },
      mobileActions: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    } satisfies BooksTableWidgetStyles),
    [isMobile, token]
  );
};
