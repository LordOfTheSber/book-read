import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

export const useAnalyticsPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      alert: { marginBottom: 20 } as CSSProperties,
      card: {
        height: '100%',
        marginBottom: 0,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      emptyBody: { padding: '48px 24px' } as CSSProperties,
      /** Карточка вывода: она первая на странице и стоит отдельно от сетки разрезов. */
      summary: {
        marginBottom: 16,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      summaryBody: { padding: '24px 26px' } as CSSProperties,
      /** Фраза, а не восемь плиток: крупный кегль с книжным интерлиньяжем. */
      phrase: {
        margin: 0,
        fontSize: 20,
        lineHeight: 1.5,
        letterSpacing: -0.2,
        maxWidth: 900
      } as CSSProperties,
      numbers: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 20,
        marginTop: 20
      } as CSSProperties,
      /** Числа разделены чертой, а не рамками: это один ряд, а не пять карточек. */
      numberCell: { flex: '1 1 150px', minWidth: 140 } as CSSProperties,
      numberCellDivided: {
        flex: '1 1 150px',
        minWidth: 140,
        paddingLeft: 20,
        borderLeft: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      numberLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        display: 'block'
      } as CSSProperties,
      numberValue: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginTop: 6
      } as CSSProperties,
      number: {
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      /** Легенда парного графика: тот же порядок, что и у столбцов — прошлое слева. */
      legend: { display: 'flex', alignItems: 'center', gap: 16 } as CSSProperties,
      legendItem: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 } as CSSProperties,
      legendSwatch: { width: 10, height: 10, borderRadius: 4 } as CSSProperties,
      /** Вывод по темпу — единственное цветное пятно карточки, как в макете. */
      note: {
        marginTop: 14,
        padding: 12,
        borderRadius: token.borderRadius,
        background: alpha(token.colorLink, 0.1),
        color: token.colorLink,
        fontSize: 13,
        lineHeight: 1.55
      } as CSSProperties,
      spineStrip: { marginBottom: 4 } as CSSProperties,
      hint: { marginTop: 12, marginBottom: 0 } as CSSProperties,
      divider: {
        marginTop: 16,
        paddingTop: 14,
        borderTop: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      /** Управление карточки, вынесенное в тело на узком экране. */
      controls: { marginBottom: 16 } as CSSProperties
    }),
    [token]
  );
};
