import React, { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';
import { AuthLayout } from '@/shared/ui/AuthLayout';
import { PasswordRules, passwordMeetsRules } from '@/shared/ui/PasswordRules';
import { usernameRules } from '@/shared/constants/validation';
import { isUsernameTakenError, useRequestError } from '@/shared/lib/errors';

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
  const [form] = Form.useForm<RegisterFormValues>();
  // Подсказка следит за вводом: правила отмечаются по мере набора, а не после отправки.
  const password = Form.useWatch('password', form) ?? '';

  const handleFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      dispatch(authActions.setCredentials(result));
      message.success('Аккаунт создан');
      navigate('/');
    } catch (error) {
      /*
       * Занятый логин — ошибка одного поля, а не всей формы: подсветив его, мы оставляем
       * набранный пароль на месте, вместо того чтобы просить ввести всё заново.
       */
      if (isUsernameTakenError(error)) {
        form.setFields([{ name: 'username', errors: ['Такой логин уже есть'] }]);
      } else {
        showRequestError(error, 'Не удалось зарегистрироваться');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Заведём аккаунт"
      subtitle="Ни почты, ни подтверждений: логин и пароль — всё, что нужно."
      footer={
        <>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark size="large">
        <Form.Item
          name="username"
          label="Логин"
          rules={usernameRules}
          extra="Латиница, цифры и точка. Логин будет виден в адресе публичной страницы."
        >
          <Input prefix={<UserOutlined />} autoComplete="username" autoFocus placeholder="Придумайте логин" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Пароль"
          /*
           * Проверяем при отправке, а не на каждую букву: пока пароль набирают, о недостающем
           * говорит список под полем, и краснеть на середине слова форме незачем.
           */
          validateTrigger="onSubmit"
          rules={[
            { required: true, message: 'Введите пароль' },
            {
              validator: (_, value: string) =>
                !value || passwordMeetsRules(value)
                  ? Promise.resolve()
                  : // Что именно не так, перечислено ниже: дублировать список строкой незачем.
                    Promise.reject(new Error('Проверьте требования ниже'))
            }
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Пароль" />
        </Form.Item>
        <PasswordRules value={password} />

        <Form.Item
          name="confirmPassword"
          label="Повторите пароль"
          dependencies={['password']}
          style={{ marginTop: 20 }}
          rules={[
            { required: true, message: 'Повторите пароль' },
            ({ getFieldValue }) => ({
              // Ошибка стоит у второго поля, а не общей строкой сверху: чинить нужно именно его.
              validator: (_, value) =>
                !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Второй пароль отличается от первого'))
            })
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Ещё раз" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Создать аккаунт
        </Button>

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Сервис живёт на вашем сервере. Данные можно забрать в CSV или JSON в любой момент.
        </Typography.Paragraph>
      </Form>
    </AuthLayout>
  );
};
