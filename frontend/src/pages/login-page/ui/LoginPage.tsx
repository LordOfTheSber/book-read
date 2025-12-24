import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';

interface LoginFormValues {
  username: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const result = await login(values);
      dispatch(authActions.setCredentials(result));
      message.success('Успешный вход');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="Вход" style={{ width: 400 }}>
        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Войти
            </Button>
          </Form.Item>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
};
