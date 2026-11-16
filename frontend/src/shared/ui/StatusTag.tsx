import React from 'react';
import { theme } from 'antd';
import type { ReadingStatus } from '@/shared/types/library';
import { getStatusAccent, getStatusLabel } from '@/shared/constants/status';
import { alpha, isDarkSurface, mix } from '@/shared/lib/color';

interface Props {
  status: ReadingStatus;
  style?: React.CSSProperties;
}

/**
 * Статус чтения чипом.
 *
 * Заливка бумажная, текст — цветом статуса: сплошные пятна пресетов Ant Design перетягивали
 * внимание с названия произведения, а тёплый цвет в интерфейсе остаётся один — закладка.
 */
export const StatusTag: React.FC<Props> = ({ status, style }) => {
  const { token } = theme.useToken();
  const accent = getStatusAccent(status);
  const dark = isDarkSurface(token.colorBgContainer);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 10px',
        borderRadius: 999,
        fontSize: token.fontSizeSM,
        lineHeight: '20px',
        whiteSpace: 'nowrap',
        background: dark ? alpha(accent, 0.26) : mix(accent, token.colorBgContainer, 0.88),
        border: `1px solid ${dark ? alpha(accent, 0.36) : mix(accent, token.colorBgContainer, 0.74)}`,
        // Ночью текст осветляется сильнее: чернильный статус «Читаю» на чернильном фоне
        // иначе теряется совсем.
        color: dark ? mix(accent, '#FFFFFF', 0.68) : accent,
        ...style
      }}
    >
      {getStatusLabel(status)}
    </span>
  );
};
