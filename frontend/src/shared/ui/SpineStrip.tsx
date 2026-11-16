import React from 'react';
import { Tooltip, theme } from 'antd';
import { MediaKind } from '@/shared/types/library';
import { kindColor } from '@/shared/config/brand';
import { getMediaKindLabel } from '@/shared/constants/mediaKind';
import { plural } from '@/shared/lib/plural';

export interface SpineShare {
  kind: MediaKind;
  count: number;
}

interface Props {
  shares: SpineShare[];
  height?: number;
  /** Подписи под полосой: на плитке в пару строк они лишние, на странице — нужны. */
  legend?: boolean;
  onSelect?: (kind: MediaKind) => void;
}

/**
 * Корешковая полоса — девять цветов видов, выстроенные в ряд.
 *
 * Приём фирменного стиля, который заодно работает как диаграмма: ширина корешка — доля вида
 * в коллекции. Одна строка вместо круговой диаграммы с легендой сбоку, и читается она так же,
 * как полка с книгами.
 */
export const SpineStrip: React.FC<Props> = ({ shares, height = 44, legend = true, onSelect }) => {
  const { token } = theme.useToken();
  const rows = shares.filter((share) => share.count > 0);
  const total = rows.reduce((sum, share) => sum + share.count, 0);

  if (total === 0) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height, borderRadius: token.borderRadius, overflow: 'hidden' }}>
        {rows.map((share) => {
          const percent = Math.round((share.count / total) * 100);
          const label = `${getMediaKindLabel(share.kind)} · ${share.count} ${plural(share.count, [
            'запись',
            'записи',
            'записей'
          ])} · ${percent}%`;

          return (
            <Tooltip key={share.kind} title={label}>
              <button
                type="button"
                className="app-shell-reset"
                aria-label={label}
                onClick={onSelect ? () => onSelect(share.kind) : undefined}
                style={{
                  flex: share.count,
                  minWidth: 3,
                  height: '100%',
                  background: kindColor[share.kind].color,
                  cursor: onSelect ? 'pointer' : 'default'
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      {legend && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '10px 16px' }}>
          {rows.map((share) => (
            <span
              key={share.kind}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                color: token.colorTextSecondary
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 4,
                  background: kindColor[share.kind].color
                }}
              />
              {getMediaKindLabel(share.kind)} · {Math.round((share.count / total) * 100)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
