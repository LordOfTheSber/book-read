import React from 'react';
import { theme } from 'antd';
import { MediaKind } from '@/shared/types/library';
import { brand, kindColor } from '@/shared/config/brand';
import { isDarkSurface, mix } from '@/shared/lib/color';

interface Props {
  /** Адрес обложки; без него рисуется заглушка. Формируется вызывающей стороной. */
  src?: string;
  title: string;
  kind?: MediaKind;
  width: number | string;
  height: number;
  radius?: number;
  /** Скруглять только верхние углы — для обложки в шапке карточки-плитки. */
  topOnly?: boolean;
  /**
   * Прочитанная доля, 0…100. Из обложки свисает закладка такой длины — приём фирменного стиля:
   * запись, которую читают, узнаётся боковым зрением, без чтения полосы прогресса под карточкой.
   */
  progressPercent?: number;
  style?: React.CSSProperties;
}

/** Две первые буквы названия: заглушка не должна быть безликой заливкой. */
const initials = (title: string) =>
  title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

/** Лента заметна с 4 % и не сливается с верхним краем — иначе начатая книга выглядит нетронутой. */
const RIBBON_MIN_PERCENT = 4;

/**
 * Обложка или заглушка на её месте. Заглушка обязательна: без неё карточки с обложкой и без неё
 * различаются по высоте на 200 пикселей и сетка перестаёт быть сеткой.
 *
 * Заглушка — бумажная плашка с корешком в цвете вида и инициалами Literata, а не градиентная
 * плитка: градиент в мелком размере читался цветным пятном и спорил с настоящими обложками.
 */
export const CoverThumb: React.FC<Props> = ({
  src,
  title,
  kind,
  width,
  height,
  radius,
  topOnly,
  progressPercent,
  style
}) => {
  const { token } = theme.useToken();
  const palette = kindColor[kind as MediaKind] ?? kindColor.BOOK;
  const corner = radius ?? token.borderRadius;
  const isDark = isDarkSurface(token.colorBgContainer);

  const radii: React.CSSProperties = topOnly
    ? { borderTopLeftRadius: corner, borderTopRightRadius: corner }
    : { borderRadius: corner };

  const box: React.CSSProperties = {
    width,
    height,
    flexShrink: 0,
    objectFit: 'cover',
    ...radii,
    ...style
  };

  const ribbon =
    progressPercent !== undefined && progressPercent > 0 ? (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          // Лента свисает из-под верхнего края, ближе к правому: там она не закрывает
          // ни корешок слева, ни инициалы по центру.
          right: '16%',
          top: 0,
          width: Math.max(5, Math.round(height * 0.1)),
          height: `${Math.max(RIBBON_MIN_PERCENT, Math.min(100, progressPercent))}%`,
          background: brand.bookmark,
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)'
        }}
      />
    ) : null;

  if (src) {
    return (
      <span style={{ position: 'relative', display: 'inline-block', flexShrink: 0, ...radii, overflow: 'hidden' }}>
        <img src={src} alt={`Обложка: ${title}`} loading="lazy" style={box} />
        {ribbon}
      </span>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        ...box,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Бумажный тон вида — самый светлый: заглушка обозначает отсутствие обложки,
        // а не спорит за внимание с теми карточками, где обложка есть.
        background: isDark ? mix(palette.color, '#000000', 0.6) : palette.paper,
        border: `1px solid ${isDark ? mix(palette.color, '#000000', 0.4) : token.colorBorderSecondary}`,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Корешок слева — то же, что у настоящей книги на полке, и заодно метка вида. */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: Math.max(3, Math.round(height * 0.065)),
          background: palette.color
        }}
      />
      <span
        className="brand-display"
        style={{
          fontSize: Math.max(11, Math.round(height * 0.2)),
          fontWeight: 700,
          letterSpacing: 0.5,
          color: isDark ? mix(palette.color, '#FFFFFF', 0.65) : palette.color
        }}
      >
        {initials(title)}
      </span>
      {ribbon}
    </div>
  );
};
