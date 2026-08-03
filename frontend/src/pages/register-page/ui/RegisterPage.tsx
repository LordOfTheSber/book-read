import React, { useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';
import { AuthLayout } from '@/shared/ui/AuthLayout';
import { newPasswordRules, usernameRules } from '@/shared/constants/validation';
import { useRequestError } from '@/shared/lib/errors';

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

export const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();

  const handleFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      dispatch(authActions.setCredentials(result));
      message.success('Аккаунт создан');
      navigate('/');
    } catch (error) {
      showRequestError(error, 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Регистрация"
      subtitle="Создайте аккаунт, чтобы вести свою библиотеку"
      footer={<>Уже есть аккаунт? <Link to="/login">Войти</Link></>}
    >
      <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
        <Form.Item name="username" label="Логин" rules={usernameRules}>
          <Input prefix={<UserOutlined />} autoComplete="username" autoFocus placeholder="Придумайте логин" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Пароль"
          rules={newPasswordRules}
          extra="Минимум 8 символов, буквы и цифры"
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Пароль" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Повторите пароль"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Повторите пароль' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Пароли не совпадают'))
            })
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Ещё раз" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Создать аккаунт
        </Button>
      </Form>
    </AuthLayout>
  );
};
