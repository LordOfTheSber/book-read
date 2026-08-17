import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useNodeDetailPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      backLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12
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
      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      meterBlock: { marginBottom: 16 } as CSSProperties,
      sectionTitle: { marginTop: 20, marginBottom: 8 } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      tabularNumbers: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      accents: {
        ok: token.colorSuccess,
        warning: token.colorWarning,
        error: token.colorError,
        uptime: token.colorInfo
      }
    }),
    [token]
  );
};
