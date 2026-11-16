import React from 'react';
import { Space, theme } from 'antd';

export interface ChoiceOption {
  label: string;
  value: string;
  /** Значок вида произведения: со значком выбор узнаётся, не читая подпись. */
  icon?: React.ReactNode;
}

interface Props {
  options: readonly ChoiceOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Подпись группы для читалок экрана: без неё чипы озвучиваются россыпью кнопок. */
  ariaLabel: string;
  /**
   * Крупный размер — для телефона: 44 px это нижняя граница удобного нажатия, и в макетах
   * добавления все чипы на узком экране именно такие.
   */
  size?: 'default' | 'large';
}

/**
 * Выбор одного значения чипами вместо выпадающего списка.
 *
 * Список из пяти статусов или девяти видов раскрывается ради одного нажатия и закрывает собой
 * соседние поля; чипы показывают все варианты сразу и на телефоне не открывают ничего поверх.
 */
export const ChoiceChips: React.FC<Props> = ({ options, value, onChange, ariaLabel, size = 'default' }) => {
  const { token } = theme.useToken();
  const large = size === 'large';

  return (
    <Space size={[8, 8]} wrap role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <button
            key={option.value || 'any'}
            type="button"
            aria-pressed={checked}
            onClick={() => onChange?.(option.value)}
            style={{
              font: 'inherit',
              fontSize: 14,
              lineHeight: 1.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              borderRadius: 999,
              minHeight: large ? 44 : 34,
              paddingInline: large ? 18 : 14,
              paddingBlock: large ? 0 : 5,
              border: `1px solid ${checked ? 'transparent' : token.colorBorder}`,
              background: checked ? token.colorPrimary : 'transparent',
              color: checked ? token.colorTextLightSolid : token.colorText,
              transition: 'background .16s ease, border-color .16s ease'
            }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </Space>
  );
};
