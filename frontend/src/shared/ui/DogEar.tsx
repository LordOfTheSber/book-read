import React from 'react';
import { theme } from 'antd';
import { alpha } from '@/shared/lib/color';
import { brand } from '@/shared/config/brand';

interface Props {
  children: React.ReactNode;
  /** Размер загнутого уголка; на плотных списках он меньше, чем на карточке цитаты. */
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Загнутый уголок страницы — метка того, что человек написал сам.
 *
 * Выписки и заметки получают его, системные карточки остаются с обычным углом: разница видна
 * боковым зрением и не требует ни подписи, ни значка. Приём фирменного стиля, который работает
 * как признак авторства.
 */
export const DogEar: React.FC<Props> = ({ children, size = 26, style }) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
        padding: '18px 20px',
        ...style
      }}
    >
      {/* Два треугольника: вырез до фона страницы и тень самого загиба под ним. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: `0 ${size}px ${size}px 0`,
          borderColor: `transparent ${token.colorBgLayout} transparent transparent`
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: `${size}px ${size}px 0 0`,
          borderColor: `${alpha(brand.ink, 0.1)} transparent transparent transparent`
        }}
      />
      {children}
    </div>
  );
};
