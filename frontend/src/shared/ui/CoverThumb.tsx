import React from 'react';
import { theme } from 'antd';
import { MediaKind } from '@/shared/types/library';
import { mediaKindMeta, getMediaKindPalette } from '@/shared/constants/mediaKind';

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

/**
 * Обложка или заглушка на её месте. Заглушка обязательна: без неё карточки с обложкой и без неё
 * различаются по высоте на 200 пикселей и сетка перестаёт быть сеткой.
 */
export const CoverThumb: React.FC<Props> = ({ src, title, kind, width, height, radius, topOnly, style }) => {
  const { token } = theme.useToken();
  const palette = getMediaKindPalette(kind);
  const corner = radius ?? token.borderRadius;

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

  if (src) {
    return <img src={src} alt={`Обложка: ${title}`} loading="lazy" style={box} />;
  }

  return (
    <div
      aria-hidden
      style={{
        ...box,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        // Тон из палитры вида — но самый светлый: заглушка обозначает отсутствие обложки,
        // а не спорит за внимание с теми карточками, где обложка есть.
        background: `linear-gradient(150deg, ${token[`${palette}1`]} 0%, ${token[`${palette}2`]} 100%)`,
        fontWeight: 700,
        letterSpacing: 1,
        overflow: 'hidden'
      }}
    >
      {/* В маленькой заглушке значок вида дублировал бы чип вида в той же строке таблицы. */}
      {height >= 72 && (
        <span style={{ fontSize: Math.max(14, Math.round(height * 0.16)), color: token[`${palette}6`] }}>
          {mediaKindMeta[kind as MediaKind]?.icon}
        </span>
      )}
      <span style={{ fontSize: Math.max(11, Math.round(height * 0.12)), color: token[`${palette}7`], opacity: 0.75 }}>
        {initials(title)}
      </span>
    </div>
  );
};
