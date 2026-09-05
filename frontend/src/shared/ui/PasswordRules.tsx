import React from 'react';
import { Space, Typography, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

/**
 * Правила пароля, каждое со своей проверкой: их видно до отправки, а не после отказа.
 *
 * Список повторяет то, что проверяет сервер (`RegisterRequest`), знак в знак. Требовать
 * больше нельзя: форма отвергала бы пароль, который сервер принимает, — и человек чинил бы
 * несуществующую ошибку.
 */
export const passwordRules = [
  { label: 'От 8 знаков', test: (value: string) => value.length >= 8 && value.length <= 64 },
  { label: 'Буквы и хотя бы одна цифра', test: (value: string) => /[A-Za-z]/.test(value) && /\d/.test(value) },
  { label: 'Без пробелов', test: (value: string) => value.length > 0 && !/\s/.test(value) }
];

/** Пароль подходит, когда выполнены все правила: одна проверка для формы и для подсказки. */
export const passwordMeetsRules = (value: string) => passwordRules.every((rule) => rule.test(value));

interface Props {
  value?: string;
}

/**
 * Требования к паролю под полем, отмечаемые по мере набора.
 *
 * Раньше о них узнавали, только нарушив: форма отвечала одной строкой «нужны буквы и цифры»
 * уже после отправки. Список показывает, что осталось, пока пароль ещё набирают.
 */
export const PasswordRules: React.FC<Props> = ({ value = '' }) => {
  const { token } = theme.useToken();

  return (
    <Space direction="vertical" size={4} style={{ display: 'flex', marginTop: 8 }}>
      {passwordRules.map((rule) => {
        const done = rule.test(value);
        return (
          <Space key={rule.label} size={8} align="center">
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 6,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done ? token.colorSuccess : token.colorFillSecondary,
                color: token.colorBgContainer
              }}
            >
              {done && <CheckOutlined style={{ fontSize: 8 }} />}
            </span>
            <Typography.Text type={done ? undefined : 'secondary'} style={{ fontSize: 13 }}>
              {rule.label}
            </Typography.Text>
          </Space>
        );
      })}
    </Space>
  );
};
