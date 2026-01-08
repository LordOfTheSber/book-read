import React, { useId } from 'react';
import { theme } from 'antd';

interface LogoProps {
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 36 }) => {
  const { token } = theme.useToken();
  const gradientId = useId();

  const primary = token.colorPrimary;
  const accent = token.colorPrimaryHover || token.colorPrimary;
  const contrast = token.colorBgContainer;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="BookRead logo"
    >
      <defs>
        <linearGradient id={`${gradientId}-cover`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id={`${gradientId}-spine`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.9} />
          <stop offset="100%" stopColor={primary} stopOpacity={0.95} />
        </linearGradient>
      </defs>
      <rect x="6" y="10" width="52" height="44" rx="10" fill={`url(#${gradientId}-cover)`} />
      <rect x="14" y="10" width="8" height="44" rx="6" fill={`url(#${gradientId}-spine)`} />
      <path
        d="M20 20h22c3.5 0 6 2.8 6 6.3v11.4c0 3.5-2.5 6.3-6 6.3H20"
        fill="none"
        stroke={contrast}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <path
        d="M20 24h18M20 32h22M20 40h16"
        fill="none"
        stroke={contrast}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
};
