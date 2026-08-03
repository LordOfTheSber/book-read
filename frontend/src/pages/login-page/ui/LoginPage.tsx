import React, { useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';
import { AuthLayout } from '@/shared/ui/AuthLayout';
import { passwordRequiredRule, usernameRules } from '@/shared/constants/validation';
import { useRequestError } from '@/shared/lib/errors';

interface LoginFormValues {
  username: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();

  const handleFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const result = await login(values);
      dispatch(authActions.setCredentials(result));
      message.success(`С возвращением, ${result.user.username}`);
      navigate('/');
    } catch (error) {
      showRequestError(error, 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Вход"
      subtitle="Войдите, чтобы вернуться к своей библиотеке"
      footer={<>Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link></>}
    >
      <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
        <Form.Item name="username" label="Логин" rules={usernameRules}>
          <Input prefix={<UserOutlined />} autoComplete="username" autoFocus placeholder="Ваш логин" />
        </Form.Item>
        <Form.Item name="password" label="Пароль" rules={passwordRequiredRule}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="Пароль" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Войти
        </Button>
      </Form>
    </AuthLayout>
  );
};
