import React from 'react';
import { Tooltip, theme } from 'antd';
import { MediaKind } from '@/shared/types/library';
import { getMediaKindLabel, kindChipColors, mediaKindMeta } from '@/shared/constants/mediaKind';
import { isDarkSurface } from '@/shared/lib/color';

interface Props {
  kind: MediaKind;
  /** Только значок — для плотных мест вроде ячейки названия в таблице. */
  iconOnly?: boolean;
}

/**
 * Вид произведения цветным чипом.
 *
 * Цвет — из девяти фирменных, одной насыщенности: пресеты Ant Design светились в строке ярче
 * названия произведения и спорили с единственным тёплым акцентом.
 */
export const KindTag: React.FC<Props> = ({ kind, iconOnly }) => {
  const { token } = theme.useToken();
  const meta = mediaKindMeta[kind];
  const label = getMediaKindLabel(kind);

  if (!meta) {
    return null;
  }

  const colors = kindChipColors(kind, isDarkSurface(token.colorBgContainer));

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    fontSize: token.fontSizeSM,
    lineHeight: '20px',
    background: colors.background,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    whiteSpace: 'nowrap'
  };

  if (iconOnly) {
    return (
      <Tooltip title={label}>
        <span aria-label={label} style={{ ...base, padding: '0 6px', borderRadius: token.borderRadiusSM }}>
          {meta.icon}
        </span>
      </Tooltip>
    );
  }

  return (
    <span style={{ ...base, padding: '0 10px', borderRadius: 999 }}>
      {meta.icon}
      {label}
    </span>
  );
};
