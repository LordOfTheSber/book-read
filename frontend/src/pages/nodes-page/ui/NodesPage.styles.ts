import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useNodesPageStyles = () => {
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
      accents: {
        online: token.colorSuccess,
        offline: token.colorError,
        cpu: token.colorInfo
      },
      alert: { marginBottom: 16 } as CSSProperties,
      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      clickableRow: { cursor: 'pointer' } as CSSProperties,
      chevron: { color: token.colorTextTertiary } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      tabularNumbers: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      meterLabel: { fontSize: 12, display: 'block', marginBottom: 2 } as CSSProperties,
      mobileList: { width: '100%' } as CSSProperties,
      mobileCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 14,
        background: token.colorBgContainer,
        cursor: 'pointer'
      } as CSSProperties,
      mobileHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 12
      } as CSSProperties,
      mobileMeters: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      } as CSSProperties,
      mobileFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      } as CSSProperties,
      emptyWrapper: {
        padding: '40px 24px',
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px dashed ${token.colorBorder}`
      } as CSSProperties
    }),
    [token]
  );
};
