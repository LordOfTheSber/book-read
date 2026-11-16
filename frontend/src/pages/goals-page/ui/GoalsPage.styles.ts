import { type CSSProperties, useMemo } from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';

/**
 * Раскладка «Целей» по макету `Goals1.dc.html`: одна цель крупно, серия полосой, достижения
 * сеткой. Стили вынесены из разметки по той же причине, что и на «Аналитике»: значения зависят
 * от токенов темы, и в JSX они превращали бы строку в абзац.
 */
export const useGoalsPageStyles = () => {
  const { token } = theme.useToken();

  return useMemo(
    () => ({
      /** Карточка главной цели: кольцо слева, вывод и числа справа, карандаш в углу. */
      goalCard: {
        marginBottom: 16,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary
      } as CSSProperties,
      goalBody: { padding: '24px 26px' } as CSSProperties,
      goalRow: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 32
      } as CSSProperties,
      goalMain: { flex: '1 1 320px', minWidth: 0 } as CSSProperties,
      /** Вывод фразой: «успеваю или нет» читается раньше, чем любые проценты. */
      phrase: {
        margin: '8px 0 0',
        fontSize: 16,
        lineHeight: 1.6,
        maxWidth: 620
      } as CSSProperties,
      numbers: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 20,
        marginTop: 20
      } as CSSProperties,
      /** Числа разделены чертой, а не рамками: это один ряд, а не четыре карточки. */
      numberCell: { flex: '1 1 130px', minWidth: 120 } as CSSProperties,
      numberCellDivided: {
        flex: '1 1 130px',
        minWidth: 120,
        paddingLeft: 20,
        borderLeft: `1px solid ${token.colorBorderSecondary}`
      } as CSSProperties,
      numberLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        display: 'block'
      } as CSSProperties,
      number: {
        display: 'block',
        marginTop: 6,
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums'
      } as CSSProperties,
      /** Цели по страницам и минутам: остаются, но не соревнуются с главной за внимание. */
      secondary: {
        marginTop: 20,
        paddingTop: 16,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24
      } as CSSProperties,
      secondaryItem: { flex: '1 1 240px', minWidth: 200 } as CSSProperties,
      card: {
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorBorderSecondary,
        height: '100%'
      } as CSSProperties,
      cardBody: { padding: 20 } as CSSProperties,
      streakRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 } as CSSProperties,
      streakBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        borderRadius: 16,
        flexShrink: 0,
        background: alpha(token.colorWarning, 0.14),
        color: token.colorWarningText,
        fontSize: 22
      } as CSSProperties,
      streakValue: { fontSize: 24, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' } as CSSProperties,
      /** Полоса дней: столбик на день, пропуск — бледный. */
      strip: { display: 'flex', gap: 4, alignItems: 'stretch' } as CSSProperties,
      stripEnds: {
        marginTop: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12
      } as CSSProperties,
      /** Достижения: полученное на бумаге мха, оставшееся — пунктиром. */
      achievements: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 12
      } as CSSProperties,
      achievement: (unlocked: boolean): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: token.borderRadius,
        background: unlocked ? alpha(token.colorSuccess, 0.1) : 'transparent',
        border: unlocked ? '1px solid transparent' : `1px dashed ${token.colorBorder}`
      }),
      achievementIcon: (unlocked: boolean): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: token.borderRadius,
        flexShrink: 0,
        background: unlocked ? token.colorBgContainer : token.colorFillQuaternary,
        color: unlocked ? token.colorSuccessText : token.colorTextQuaternary
      }),
      /** Полоса «Года в обзоре»: единственное цветное пятно страницы, как в макете. */
      review: {
        marginTop: 16,
        padding: '18px 22px',
        borderRadius: token.borderRadiusLG,
        background: alpha(token.colorLink, 0.1),
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      } as CSSProperties,
      reviewTitle: { fontWeight: 600, color: token.colorLink } as CSSProperties
    }),
    [token]
  );
};
