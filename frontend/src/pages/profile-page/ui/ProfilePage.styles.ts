import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useProfilePageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      page: {
        maxWidth: 1440,
        margin: '0 auto',
        width: '100%'
      } as CSSProperties,
      stats: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20
      } as CSSProperties,
      alert: { marginBottom: 16 } as CSSProperties,
      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      identity: {
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap'
      } as CSSProperties,
      identityMeta: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
        flex: '1 1 240px'
      } as CSSProperties,
      identityActions: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      } as CSSProperties,
      avatar: { cursor: 'pointer', flexShrink: 0 } as CSSProperties,
      username: { margin: 0, fontSize: 24, lineHeight: 1.2 } as CSSProperties,
      tag: { fontWeight: 600, borderRadius: 999, paddingInline: 10 } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      sectionTitle: { marginTop: 0, marginBottom: 12 } as CSSProperties,
      achievements: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16
      } as CSSProperties,
      achievementCard: (earned: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: 16,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${earned ? token.colorBorderSecondary : token.colorBorder}`,
        borderStyle: earned ? 'solid' : 'dashed',
        background: earned ? token.colorBgContainer : 'transparent'
      }),
      achievementIcon: (color: string, earned: boolean): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: '50%',
        fontSize: 20,
        background: earned ? `${color}1f` : token.colorFillQuaternary,
        color: earned ? color : token.colorTextQuaternary
      })
    }),
    [token]
  );
};
