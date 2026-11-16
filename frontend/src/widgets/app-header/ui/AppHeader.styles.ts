import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';

/**
 * Геометрия шапки взята из макета `Header.dc.html`: высота 60, вкладки 34 с радиусом 10,
 * поле поиска 36 и не шире 420 — оно должно оставлять место действию справа.
 */
export const useAppHeaderStyles = () => {
  const { token } = theme.useToken();

  return useMemo(() => {
    const tab = (active: boolean): CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      height: 34,
      padding: '0 13px',
      borderRadius: 10,
      whiteSpace: 'nowrap',
      // Фон только у выбранной: инлайновый фон перебил бы наведение из таблицы стилей.
      ...(active ? { background: token.colorPrimaryBg } : null),
      color: active ? token.colorPrimary : token.colorText,
      fontWeight: active ? 600 : 400
    });

    return {
      tab,
      header: {
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 60,
        lineHeight: 'normal',
        paddingInline: 24,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      inner: {
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
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
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: -0.2,
        color: token.colorText
      } as CSSProperties,
      tabs: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0
      } as CSSProperties,
      // Поиск занимает всё свободное место посередине, но не растягивается бесконечно:
      // на широком мониторе поле во всю ширину уводило действие «Добавить» к самому краю.
      searchSlot: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        justifyContent: 'center'
      } as CSSProperties,
      searchButton: {
        width: '100%',
        maxWidth: 420,
        height: 36,
        padding: '0 11px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        color: token.colorTextTertiary,
        cursor: 'pointer',
        textAlign: 'left'
      } as CSSProperties,
      searchLabel: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      } as CSSProperties,
      hotkey: {
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        padding: '2px 6px',
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        color: token.colorTextTertiary
      } as CSSProperties,
      actions: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        marginLeft: 'auto'
      } as CSSProperties,
      userButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 34,
        padding: '0 8px 0 4px',
        borderRadius: 999,
        border: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      menuCard: {
        minWidth: 268,
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        overflow: 'hidden'
      } as CSSProperties,
      menuHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      menuSection: {
        padding: 6
      } as CSSProperties,
      menuFoot: {
        padding: 6,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      dangerColor: token.colorError,
      menuRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 36,
        padding: '0 10px',
        borderRadius: 8,
        color: token.colorText
      } as CSSProperties,
      themeBlock: {
        padding: '10px 12px',
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      themeLabel: {
        fontSize: 12,
        color: token.colorTextTertiary,
        marginBottom: 8
      } as CSSProperties,
      themeRow: {
        display: 'flex',
        gap: 6
      } as CSSProperties,
      themeChip: (active: boolean): CSSProperties => ({
        flex: 1,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: 10,
        fontSize: 13,
        border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        color: active ? token.colorPrimary : token.colorTextSecondary,
        fontWeight: active ? 500 : 400
      }),
      swatch: {
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: `1px solid ${token.colorBorder}`
      } as CSSProperties,
      groupHeading: {
        gridColumn: '1 / -1',
        padding: '10px 10px 4px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: token.colorTextTertiary
      } as CSSProperties,
      // Две колонки: одиннадцать пунктов в столбик — это список высотой в половину экрана.
      moreCard: {
        width: 470,
        padding: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '4px 12px',
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary
      } as CSSProperties,
      dot: (color: string): CSSProperties => ({
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        flexShrink: 0,
        background: color
      })
    };
  }, [token]);
};
