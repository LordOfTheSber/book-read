import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

export const useBooksListStyles = () => {
  const { token } = theme.useToken();

  return useMemo(() => {
    const muted: CSSProperties = { color: token.colorTextTertiary };

    return {
      muted,
      tag: { fontWeight: 600, borderRadius: 999, paddingInline: 10 } as CSSProperties,
      neutralTag: {
        borderRadius: 999,
        paddingInline: 10,
        background: token.colorFillQuaternary,
        color: token.colorTextSecondary
      } as CSSProperties,
      favoriteIcon: { color: token.colorWarning, fontSize: 16 } as CSSProperties,
      rating: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      ratingIcon: { color: token.colorWarning, fontSize: 13 } as CSSProperties,
      sourceLink: { display: 'inline-flex', alignItems: 'center', gap: 4 } as CSSProperties,

      titleWrap: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 } as CSSProperties,
      rowCover: { border: `1px solid ${token.colorBorderSecondary}` } as CSSProperties,
      titleCell: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as CSSProperties,
      titleRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } as CSSProperties,
      altTitle: { fontSize: 12 } as CSSProperties,

      table: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden'
      } as CSSProperties,
      tablePagination: { padding: '12px 16px', marginBottom: 0 } as CSSProperties,

      // --- Список строками (Main.dc.html) ---
      listHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 44,
        padding: '0 16px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        fontSize: 12,
        fontWeight: 600,
        color: token.colorTextTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.4
      } as CSSProperties,
      listRow: (last: boolean, selected: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '11px 16px',
        borderBottom: last ? undefined : `1px solid ${token.colorBorderSecondary}`,
        ...(selected ? { background: token.colorPrimaryBg } : null)
      }),
      // Строка телефона: две колонки вместо шести, обложка крупнее — она же цель нажатия.
      mobileRow: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderBottom: last ? undefined : `1px solid ${token.colorBorderSecondary}`
      }),
      rowTitle: {
        fontWeight: 600,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      } as CSSProperties,
      rowMeta: {
        marginTop: 3,
        fontSize: 13,
        color: token.colorTextTertiary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      } as CSSProperties,
      listFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,

      card: {
        height: '100%',
        // Колонка из обложки и тела: без неё body с height:100% растягивал карточку
        // на высоту обложки сверх её собственной и оставлял пустоту над подвалом.
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary,
        overflow: 'hidden'
      } as CSSProperties,
      cardBody: { padding: 16, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0 } as CSSProperties,
      // Обложка есть у каждой карточки — своя или заглушка, поэтому сетка не рвётся по высоте.
      coverWrap: { position: 'relative' } as CSSProperties,
      cardCover: { display: 'block' } as CSSProperties,
      coverBadges: {
        position: 'absolute',
        insetInline: 10,
        top: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        pointerEvents: 'none'
      } as CSSProperties,
      selectBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: token.borderRadiusSM,
        // Обложка под флажком может быть любой — подложка держит контраст.
        background: token.colorBgElevated,
        boxShadow: token.boxShadowTertiary,
        // Контейнер значков не ловит указатель, а флажок должен.
        pointerEvents: 'auto'
      } as CSSProperties,
      favoriteBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        // Обложка под значком может быть любой — подложка держит контраст.
        background: token.colorBgElevated,
        color: token.colorWarning,
        boxShadow: token.boxShadowTertiary,
        pointerEvents: 'auto'
      } as CSSProperties,

      progressBlock: { display: 'flex', flexDirection: 'column', gap: 0, marginTop: 10 } as CSSProperties,
      progressBar: { margin: 0, lineHeight: 1 } as CSSProperties,
      progressMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as CSSProperties,
      progressText: { fontSize: 12, fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      /*
       * «+10» — то, ради чего список открывают чаще всего, и на телефоне это была цель
       * 22×16 пикселей. Отступы дают палец, вид ссылки остаётся: на мыши кнопка выглядит
       * так же, просто с полями вокруг.
       */
      advanceButton: { padding: '0 10px', height: 40, marginBlock: -8, fontSize: 13 } as CSSProperties,

      cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as CSSProperties,
      cardTitle: { margin: '8px 0 0', fontSize: 16, lineHeight: 1.35 } as CSSProperties,
      cardAltTitle: { margin: 0, fontSize: 12 } as CSSProperties,
      cardTags: { marginTop: 8 } as CSSProperties,
      cardFooter: {
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      } as CSSProperties,
      cardAuthor: { fontSize: 11, marginTop: 6 } as CSSProperties,

      emptyWrapper: {
        padding: '48px 24px',
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px dashed ${token.colorBorder}`
      } as CSSProperties,
      paginationBar: { display: 'flex', justifyContent: 'flex-end', marginTop: 20 } as CSSProperties
    };
  }, [token]);
};
