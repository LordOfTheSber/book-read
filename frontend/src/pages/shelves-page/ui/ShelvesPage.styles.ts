import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

/**
 * Раскладка «Полок и тегов» по макету `Shelves2.dc.html`: слева полки строками, справа теги
 * с полосой веса и уборкой дублей.
 */
export const useShelvesPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      columns: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start'
      } as CSSProperties,
      columnsNarrow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 } as CSSProperties,
      /** Подпись колонки со счётчиком: она заменяет заголовок карточки, рамки внутри рамки нет. */
      sectionHead: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12
      } as CSSProperties,
      sectionLabel: {
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4
      } as CSSProperties,
      card: {
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      listBody: { padding: 0 } as CSSProperties,
      tagsBody: { padding: '8px 12px' } as CSSProperties,
      row: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 16px',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      /** Значок полки цветной, но не пёстрый: цвет берётся из палитры бренда по имени полки. */
      shelfIcon: (color: string): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: token.borderRadius,
        flexShrink: 0,
        background: alpha(color, 0.12),
        color
      }),
      count: {
        fontSize: 13,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0
      } as CSSProperties,
      tagRow: (last: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '9px 8px',
        borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`
      }),
      /** Полоса веса: 120 px на самый частый тег, остальные — долей от него. */
      weight: {
        width: 120,
        height: 6,
        borderRadius: 999,
        background: token.colorFillSecondary,
        overflow: 'hidden',
        flexShrink: 0
      } as CSSProperties,
      weightFill: (percent: number): CSSProperties => ({
        display: 'block',
        width: `${percent}%`,
        height: '100%',
        borderRadius: 999,
        background: token.colorPrimary
      }),
      /** Пояснение про умные полки: они сохранённые фильтры и живут над списком библиотеки. */
      note: {
        marginTop: 14,
        padding: '14px 16px',
        borderRadius: token.borderRadius,
        background: alpha(token.colorLink, 0.1),
        color: token.colorLink,
        fontSize: 13,
        lineHeight: 1.6
      } as CSSProperties,
      cleanup: { marginTop: 14, borderRadius: token.borderRadiusLG, borderColor: token.colorBorderSecondary } as CSSProperties
    }),
    [token]
  );
};
