import type { Rule } from 'antd/es/form';

export const usernameRules: Rule[] = [
  { required: true, message: 'Введите логин' },
  { min: 3, max: 32, message: 'От 3 до 32 символов' },
  {
    pattern: /^[A-Za-z0-9._-]+$/,
    message: 'Только латинские буквы, цифры, точка, тире и подчёркивание'
  }
];

/**
 * Требования к новому паролю. На входе их не применяем: иначе пользователь
 * с паролем, заведённым до изменения правил, не сможет отправить форму.
 */
export const newPasswordRules: Rule[] = [
  { required: true, message: 'Введите пароль' },
  { min: 8, max: 64, message: 'От 8 до 64 символов' },
  {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)[\S]+$/,
    message: 'Нужны буквы и цифры, без пробелов'
  }
];

export const passwordRequiredRule: Rule[] = [{ required: true, message: 'Введите пароль' }];
