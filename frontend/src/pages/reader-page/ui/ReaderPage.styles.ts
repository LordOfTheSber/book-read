import { useMemo } from 'react';
import { theme } from 'antd';

export const useReaderPageStyles = (isMobile: boolean) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      wrapper: {
        maxWidth: 900,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 16
      },
      headerCard: {
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer
      },
      headerCardBody: {
        padding: isMobile ? 12 : 20
      },
      headerTop: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12
      },
      titleBlock: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 2,
        flex: 1,
        minWidth: 0
      },
      title: {
        margin: 0
      },
      description: {
        marginBottom: 12
      },
      navBar: {
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 12,
        flexWrap: 'wrap' as const
      },
      chapterSelect: {
        flex: 1,
        minWidth: isMobile ? 120 : 200,
        maxWidth: 400
      },
      chapterCount: {
        whiteSpace: 'nowrap' as const,
        fontSize: isMobile ? 12 : 14
      },
      contentCard: {
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer
      },
      contentBody: {
        padding: isMobile ? '16px 12px' : '32px 40px'
      },
      storyText: {
        fontSize: isMobile ? 15 : 17,
        lineHeight: 1.8,
        color: token.colorText,
        wordBreak: 'break-word' as const
      },
      footerCard: {
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer
      },
      footerBody: {
        padding: isMobile ? 12 : 16
      },
      loader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
        padding: 32
      },
      pageCard: {
        borderRadius: 14,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer,
        maxWidth: 900,
        margin: '0 auto'
      }
    }),
    [isMobile, token]
  );
};
