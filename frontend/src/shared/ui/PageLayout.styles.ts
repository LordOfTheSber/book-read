import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

interface PageLayoutStyles {
  layout: CSSProperties;
  header: CSSProperties;
  headerContent: CSSProperties;
  headerTopRow: CSSProperties;
  brand: CSSProperties;
  brandText: CSSProperties;
  brandTitle: CSSProperties;
  brandSubtitle: CSSProperties;
  menuContainer: CSSProperties;
  menu: CSSProperties;
  mobileMenu: CSSProperties;
  headerExtra: CSSProperties;
  toggleLabel: CSSProperties;
  content: CSSProperties;
  mobileMenuButton: CSSProperties;
  mobileThemeButton: CSSProperties;
  mobileDrawerBody: CSSProperties;
  mobileMenuFooter: CSSProperties;
}

export const usePageLayoutStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      layout: { minHeight: '100vh' },
      header: {
        padding: isMobile ? '6px 0' : 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: isMobile ? 'auto' : 60,
        minHeight: 60,
        background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 50%, ${token.blue || '#1677ff'} 100%)`,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        fontFamily: token.fontFamily,
        overflow: 'hidden'
      },
      headerContent: {
        width: '100%',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'flex-start',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 12,
        paddingInline: isMobile ? 12 : 14,
        paddingBlock: isMobile ? 6 : 0,
        height: isMobile ? 'auto' : 60,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        boxSizing: 'border-box'
      },
      headerTopRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        width: '100%'
      },
      brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: token.colorWhite,
        paddingInline: 4,
        flex: isMobile ? '1 1 auto' : '0 1 auto',
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
        display: isMobile ? 'none' : 'flex',
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
      mobileMenu: {
        background: token.colorBgContainer,
        borderRadius: 12,
        paddingInline: 6,
        paddingBlock: 6
      },
      headerExtra: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'flex-end',
        gap: 8,
        color: token.colorWhite,
        flex: '0 0 auto',
        minWidth: 0,
        width: isMobile ? '100%' : 'auto',
        height: '100%',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      },
      toggleLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: 'rgba(255,255,255,0.78)'
      },
      content: { padding: isMobile ? '16px 12px 24px' : '24px' },
      mobileMenuButton: {
        borderColor: 'rgba(255,255,255,0.4)',
        color: token.colorWhite,
        background: 'rgba(255,255,255,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      },
      mobileThemeButton: {
        width: 36,
        height: 36,
        minWidth: 36,
        padding: 0,
        borderColor: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.18)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
      },
      mobileDrawerBody: {
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      },
      mobileMenuFooter: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 4
      }
    } satisfies PageLayoutStyles),
    [isMobile, token]
  );
};
