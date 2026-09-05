import React, { useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { changeMyPassword } from '@/entities/account';
import { authActions } from '@/entities/auth';
import { useAppDispatch } from '@/shared/lib/hooks';
import { useRequestError } from '@/shared/lib/errors';
import { PasswordRules, passwordMeetsRules } from '@/shared/ui/PasswordRules';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  repeat: string;
}

/**
 * Смена пароля по макету `AuthForms.dc.html`.
 *
 * До этого пароль вводили ровно в двух местах — на входе и при удалении аккаунта: сменить его
 * было нельзя вообще, и утёкший пароль оставался единственным.
 *
 * Вместе с паролем сервер гасит все сессии и запомненные устройства, включая текущее, — поэтому
 * форма честно предупреждает об этом до нажатия и уводит на вход после.
 */
export const ChangePasswordCard: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const showRequestError = useRequestError();
  const [saving, setSaving] = useState(false);
  const newPassword = Form.useWatch('newPassword', form) ?? '';

  const submit = async (values: FormValues) => {
    setSaving(true);
    try {
      await changeMyPassword(values.currentPassword, values.newPassword);
      message.success('Пароль изменён. Войдите заново — на всех устройствах');
      // Куки сервер уже погасил; стор нужно привести в то же состояние, иначе экран останется
      // «как будто вошли», а любой запрос вернёт 401.
      dispatch(authActions.logout());
      navigate('/login', { replace: true });
    } catch (error) {
      showRequestError(error, 'Не удалось сменить пароль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Пароль">
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        После смены придётся войти заново: сессии и запомненные устройства сбрасываются — в том
        числе на других компьютерах и телефонах.
      </Typography.Paragraph>

      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} style={{ maxWidth: 420 }}>
        <Form.Item
          name="currentPassword"
          label="Текущий пароль"
          rules={[{ required: true, message: 'Введите текущий пароль' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Новый пароль"
          rules={[
            { required: true, message: 'Введите новый пароль' },
            {
              validator: (_, value: string) =>
                !value || passwordMeetsRules(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('Пароль не отвечает требованиям'))
            }
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <PasswordRules value={newPassword} />

        <Form.Item
          name="repeat"
          label="Ещё раз"
          dependencies={['newPassword']}
          style={{ marginTop: 12 }}
          rules={[
            { required: true, message: 'Повторите новый пароль' },
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                !value || value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Пароли не совпадают'))
            })
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving}>
          Сменить пароль
        </Button>
      </Form>
    </Card>
  );
};
