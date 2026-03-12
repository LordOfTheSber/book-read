import { useMemo, type CSSProperties } from 'react';
import { theme } from 'antd';

export type ReaderFontOption = 'serif' | 'sans-serif' | 'monospace';

export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  fontFamily: ReaderFontOption;
  contentWidth: number;
};

const fontFamilyMap: Record<ReaderFontOption, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  'sans-serif': 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  monospace: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace'
};

export const useReaderPageStyles = (isMobile: boolean, settings: ReaderSettings) => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      wrapper: {
        maxWidth: settings.contentWidth,
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
      settingsPanel: {
        marginBottom: 24,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgLayout,
        borderRadius: 12,
        padding: isMobile ? 12 : 16
      },
      settingsTitle: {
        display: 'block',
        marginBottom: 12
      },
      storyText: {
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        color: token.colorText,
        wordBreak: 'break-word' as const,
        fontFamily: fontFamilyMap[settings.fontFamily],
        '--reader-paragraph-spacing': `${settings.paragraphSpacing}px`
      } as CSSProperties,
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
    [isMobile, settings, token]
  );
};
