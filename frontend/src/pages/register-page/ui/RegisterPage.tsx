import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

export const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleFinish = async (values: RegisterFormValues) => {
    if (values.password !== values.confirmPassword) {
      message.error('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      dispatch(authActions.setCredentials(result));
      message.success('Регистрация успешна');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="Регистрация" style={{ width: 400 }}>
        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Повторите пароль"
            rules={[{ required: true, message: 'Повторите пароль' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Зарегистрироваться
            </Button>
          </Form.Item>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
};
