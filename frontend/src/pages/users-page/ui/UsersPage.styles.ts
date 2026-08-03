import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useUsersPageStyles = () => {
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
        blocked: token.colorError,
        overrides: token.colorWarning
      },
      toolbar: {
        padding: 12,
        marginBottom: 20,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG
      } as CSSProperties,
      searchIcon: { color: token.colorTextTertiary } as CSSProperties,
      alert: { marginBottom: 16 } as CSSProperties,
      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      tag: { fontWeight: 600, borderRadius: 999, paddingInline: 10 } as CSSProperties,
      hint: { fontSize: 12 } as CSSProperties,
      tabularNumbers: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      fullWidth: { width: '100%' } as CSSProperties,
      mobileList: { width: '100%' } as CSSProperties,
      mobileCard: {
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 14,
        background: token.colorBgContainer
      } as CSSProperties,
      mobileHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8
      } as CSSProperties,
      mobileFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap'
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
