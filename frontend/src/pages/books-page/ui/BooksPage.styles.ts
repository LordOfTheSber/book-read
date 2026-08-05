import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useBooksPageStyles = () => {
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
        reading: token.colorInfo,
        completed: token.colorSuccess,
        // «В планах» и «Избранное» раньше красились одним и тем же colorWarning и сливались.
        planned: token.purple6,
        favorite: token.colorWarning
      }
    }),
    [token]
  );
};
