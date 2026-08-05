import React from 'react';
import { Tag, Tooltip } from 'antd';
import { MediaKind } from '@/shared/types/library';
import { getMediaKindLabel, getMediaKindPalette, mediaKindMeta } from '@/shared/constants/mediaKind';

interface Props {
  kind: MediaKind;
  /** Только значок — для плотных мест вроде ячейки названия в таблице. */
  iconOnly?: boolean;
}

/**
 * Вид произведения цветным чипом. Раньше вид показывался серым значком цвета
 * `colorTextQuaternary` — он читался как декорация, а не как признак записи.
 */
export const KindTag: React.FC<Props> = ({ kind, iconOnly }) => {
  const meta = mediaKindMeta[kind];
  const label = getMediaKindLabel(kind);

  if (!meta) {
    return null;
  }

  if (iconOnly) {
    return (
      <Tooltip title={label}>
        <Tag
          color={getMediaKindPalette(kind)}
          bordered={false}
          aria-label={label}
          style={{ marginInlineEnd: 0, paddingInline: 6, lineHeight: '20px' }}
        >
          {meta.icon}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tag
      color={getMediaKindPalette(kind)}
      bordered={false}
      style={{ marginInlineEnd: 0, borderRadius: 999, paddingInline: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {meta.icon}
      {label}
    </Tag>
  );
};
