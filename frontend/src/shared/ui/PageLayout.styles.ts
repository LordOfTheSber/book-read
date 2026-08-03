import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const usePageLayoutStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      // Скроллит страница целиком: липкая шапка и липкие заголовки таблиц
      // работают только без внутреннего контейнера с overflow.
      layout: {
        minHeight: '100vh',
        background: token.colorBgLayout
      } as CSSProperties,
      loader: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.colorBgLayout
      } as CSSProperties,
      header: {
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 60,
        lineHeight: 'normal',
        paddingInline: isMobile ? 12 : 24,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      headerInner: {
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 24,
        maxWidth: 1440,
        margin: '0 auto'
      } as CSSProperties,
      brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        color: token.colorText
      } as CSSProperties,
      brandTitle: {
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: -0.2,
        color: token.colorText
      } as CSSProperties,
      menu: {
        flex: 1,
        minWidth: 0,
        borderBottom: 'none',
        background: 'transparent',
        lineHeight: '58px'
      } as CSSProperties,
      headerActions: {
        marginLeft: 'auto',
        flexShrink: 0
      } as CSSProperties,
      userButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingInline: 8
      } as CSSProperties,
      userName: {
        fontWeight: 600,
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      } as CSSProperties,
      swatch: {
        display: 'inline-block',
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: `1px solid ${token.colorBorder}`
      } as CSSProperties,
      checkIcon: { color: token.colorPrimary, fontSize: 12 } as CSSProperties,
      drawerBody: {
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16
      } as CSSProperties,
      drawerMenu: {
        border: 'none',
        background: 'transparent'
      } as CSSProperties,
      drawerFooter: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      } as CSSProperties,
      content: {
        padding: isMobile ? '16px 12px 32px' : '28px 24px 48px'
      } as CSSProperties
    }),
    [isMobile, token]
  );
};
