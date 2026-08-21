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
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();

  const handleFinish = async (values: LoginFormValues) => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await login(values);
      dispatch(authActions.setCredentials(result));
      message.success(`С возвращением, ${result.user.username}`);
      navigate('/');
    } catch (error) {
      /*
       * Не уточняем, что именно не подошло. Ответ «логин верный, пароль нет» подсказывает
       * подбирающему, что учётная запись существует, — и превращает форму входа в проверку,
       * кто здесь зарегистрирован.
       */
      setFailed(true);
      showRequestError(error, 'Логин или пароль не подходят');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="С возвращением"
      subtitle="Библиотека ждёт вас на месте"
      footer={
        <>
          Впервые здесь? <Link to="/register">Завести аккаунт</Link>
        </>
      }
    >
      <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
        <Form.Item
          name="username"
          label="Логин"
          rules={usernameRules}
          validateStatus={failed ? 'error' : undefined}
        >
          <Input
            prefix={<UserOutlined />}
            autoComplete="username"
            autoFocus
            placeholder="Ваш логин"
            onChange={() => setFailed(false)}
          />
        </Form.Item>
        {/*
          * Ссылки «Забыли пароль?» здесь нет намеренно: восстанавливать доступ пока не по чему —
          * у аккаунта нет почты, и ссылка вела бы в тупик. Она появится вместе с восстановлением.
          */}
        <Form.Item
          name="password"
          label="Пароль"
          rules={passwordRequiredRule}
          validateStatus={failed ? 'error' : undefined}
          help={failed ? 'Логин или пароль не подходят' : undefined}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
            placeholder="Пароль"
            onChange={() => setFailed(false)}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Войти
        </Button>
      </Form>
    </AuthLayout>
  );
};
