import React from 'react';
import { brand } from '@/shared/config/brand';

interface LogoProps {
  size?: number;
  /**
   * Доля годовой цели, 0…1. Закладка в знаке опускается вместе с ней: к декабрю она доходит
   * до низа корешка. Вне приложения — иконка, публичная страница, письма — закладка всегда
   * полная, иначе знак перестаёт быть узнаваемым.
   */
  goalProgress?: number;
  /** Знак на тёмном: корешок становится бумажным, закладка остаётся закладкой. */
  inverted?: boolean;
  title?: string;
}

/** Геометрия из макета: корешок 44×48 с бумажной линией сгиба и лентой справа. */
const SPINE_TOP = 8;
const SPINE_HEIGHT = 48;
/** Полная лента доходит до 48 — на 8 px выше низа корешка, как на артборде знака. */
const RIBBON_FULL = 40;
/** Совсем пустая лента всё же видна: иначе знак теряет тёплое пятно и читается как прямоугольник. */
const RIBBON_MIN = 6;

const ribbonPath = (progress: number) => {
  const length = RIBBON_MIN + Math.round((RIBBON_FULL - RIBBON_MIN) * Math.min(1, Math.max(0, progress)));
  const bottom = SPINE_TOP + length;
  // Прямоугольник с треугольной прорезью снизу — тот же вырез, что у полного знака.
  // У короткой ленты вырез мельче, иначе он съедает её целиком.
  const notch = Math.min(6.5, length / 2);
  return `M34 ${SPINE_TOP}h11v${length}l-5.5 -${notch}L34 ${bottom}z`;
};

export const Logo: React.FC<LogoProps> = ({ size = 36, goalProgress = 1, inverted, title }) => {
  const body = inverted ? brand.paper : brand.ink;
  const fold = inverted ? brand.ink : brand.paper;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? 'BookRead'}>
      <rect x="10" y={SPINE_TOP} width="44" height={SPINE_HEIGHT} rx="9" fill={body} />
      <rect x="18" y={SPINE_TOP} width="3" height={SPINE_HEIGHT} fill={fold} opacity={0.22} />
      <path d={ribbonPath(goalProgress)} fill={brand.bookmark} />
    </svg>
  );
};
