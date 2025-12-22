import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

interface PageLayoutStyles {
  layout: CSSProperties;
  header: CSSProperties;
  headerContent: CSSProperties;
  brand: CSSProperties;
  brandText: CSSProperties;
  brandTitle: CSSProperties;
  brandSubtitle: CSSProperties;
  menuContainer: CSSProperties;
  menu: CSSProperties;
  headerExtra: CSSProperties;
  toggleLabel: CSSProperties;
  content: CSSProperties;
}

export const usePageLayoutStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      layout: { minHeight: '100vh' },
      header: {
        padding: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 60,
        minHeight: 60,
        background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 50%, ${token.blue || '#1677ff'} 100%)`,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        fontFamily: token.fontFamily,
        overflow: 'hidden'
      },
      headerContent: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        paddingInline: 14,
        paddingBlock: 0,
        height: 60,
        flexWrap: 'nowrap',
        boxSizing: 'border-box'
      },
      brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: token.colorWhite,
        paddingInline: 4,
        flex: '0 1 auto',
        minWidth: 0
      },
      brandText: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        lineHeight: 1.1,
        minWidth: 0
      },
      brandTitle: {
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: 0.3,
        lineHeight: 1.1,
        color: token.colorWhite,
        fontFamily: token.fontFamily
      },
      brandSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.82)',
        marginTop: 0,
        fontFamily: token.fontFamily
      },
      menuContainer: {
        flex: '1 1 320px',
        minWidth: 220,
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        height: '100%'
      },
      menu: {
        background: 'transparent',
        flex: 1,
        minWidth: 0,
        borderBottom: 'none',
        borderRadius: 10,
        paddingInline: 8,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        height: '100%'
      },
      headerExtra: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        color: token.colorWhite,
        flex: '0 0 auto',
        minWidth: 0,
        height: '100%'
      },
      toggleLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: 'rgba(255,255,255,0.78)'
      },
      content: { padding: '24px' }
    } satisfies PageLayoutStyles),
    [token]
  );
};
