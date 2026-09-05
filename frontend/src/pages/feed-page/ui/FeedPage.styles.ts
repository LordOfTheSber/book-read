import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useFeedPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      /** Посты идут колонкой с одинаковым шагом: `.ant-card` со своим отступом здесь мешает. */
      posts: { display: 'flex', flexDirection: 'column', gap: 16 } as CSSProperties,
      rail: { display: 'flex', flexDirection: 'column', gap: 14 } as CSSProperties,
      railCard: {
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      railBody: { padding: '16px 18px' } as CSSProperties,
      emptyBody: { padding: '48px 24px' } as CSSProperties,
      railTitle: {
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 12
      } as CSSProperties,
      railHint: { display: 'block', fontSize: 12, marginTop: 10 } as CSSProperties,
      trending: { display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties,
      trendingRow: { display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' } as CSSProperties,
      trendingText: { flex: 1, minWidth: 0 } as CSSProperties,
      trendingTitle: { display: 'block', fontSize: 13, fontWeight: 500 } as CSSProperties,
      trendingHint: { display: 'block', fontSize: 12 } as CSSProperties,
      notice: { marginTop: 16, marginBottom: 0 } as CSSProperties
    }),
    [token]
  );
};
