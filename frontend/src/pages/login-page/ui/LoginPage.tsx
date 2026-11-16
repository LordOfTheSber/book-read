import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Checkbox, Divider, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { DeviceHint, fetchDeviceHint, forgetThisDevice, login, loginByDevice } from '@/entities/auth/api/authApi';
import { useAppDispatch } from '@/shared/lib/hooks';
import { authActions } from '@/entities/auth';
import { AuthLayout } from '@/shared/ui/AuthLayout';
import { getDeviceFingerprint } from '@/shared/lib/deviceFingerprint';
import { isQuickLoginSuppressed } from '@/shared/api/authSession';
import { passwordRequiredRule, usernameRules } from '@/shared/constants/validation';
import { useRequestError } from '@/shared/lib/errors';

interface LoginFormValues {
  username: string;
  password: string;
  rememberDevice: boolean;
}

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | undefined>();
  const [hint, setHint] = useState<DeviceHint | undefined>();
  const [quickLoading, setQuickLoading] = useState(false);
  /** Опознание — разовое действие: повторный проход означал бы вторую попытку входа на ровном месте. */
  const deviceChecked = useRef(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();

  const quickLogin = useCallback(
    async (deviceFingerprint: string) => {
      setQuickLoading(true);
      try {
        const result = await loginByDevice(deviceFingerprint);
        dispatch(authActions.setCredentials(result));
        message.success(`С возвращением, ${result.user.username}`);
        navigate('/');
      } catch {
        /*
         * Устройство отозвали с другого экрана или истёк срок доверия. Ошибку не показываем
         * красным: человек ничего не сделал не так — просто снова нужен пароль, а форма уже здесь.
         */
        setHint(undefined);
        message.info('Устройство больше не узнаётся — войдите с паролем');
      } finally {
        setQuickLoading(false);
      }
    },
    [dispatch, message, navigate]
  );

  /*
   * Опознание устройства при открытии экрана. Если сервер узнал устройство и человек не выходил
   * сам, вход происходит без единого нажатия — ради этого всё и затевалось; после явного выхода
   * остаётся кнопка «продолжить как», иначе выйти было бы нельзя.
   */
  useEffect(() => {
    if (deviceChecked.current) {
      return undefined;
    }
    deviceChecked.current = true;
    let cancelled = false;

    void (async () => {
      const deviceFingerprint = await getDeviceFingerprint();
      if (cancelled || !deviceFingerprint) {
        return;
      }
      setFingerprint(deviceFingerprint);

      const known = await fetchDeviceHint(deviceFingerprint).catch(() => undefined);
      if (cancelled || !known) {
        return;
      }
      setHint(known);
      if (!isQuickLoginSuppressed()) {
        await quickLogin(deviceFingerprint);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quickLogin]);

  const forgetDevice = async () => {
    await forgetThisDevice();
    setHint(undefined);
    message.success('Устройство забыто');
  };

  const handleFinish = async (values: LoginFormValues) => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await login({
        username: values.username,
        password: values.password,
        // Просить сервер запомнить устройство, не умея посчитать отпечаток, бессмысленно:
        // он всё равно откажет, а галочка обещала бы быстрый вход, которого не будет.
        rememberDevice: Boolean(values.rememberDevice && fingerprint),
        deviceFingerprint: fingerprint
      });
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
      {hint && (
        <Space direction="vertical" size={8} style={{ display: 'flex', marginBottom: 8 }}>
          <Typography.Text>
            Это устройство помнит <Typography.Text strong>{hint.displayName || hint.username}</Typography.Text>
          </Typography.Text>
          <Button
            type="primary"
            block
            size="large"
            loading={quickLoading}
            onClick={() => fingerprint && quickLogin(fingerprint)}
          >
            {`Продолжить как ${hint.username}`}
          </Button>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={forgetDevice}>
            Это не я — забыть устройство
          </Button>
          <Divider plain style={{ margin: '4px 0' }}>
            или войдите с паролем
          </Divider>
        </Space>
      )}

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
        {/*
          * Галочка стоит по умолчанию: свой телефон и свой ноутбук — обычный случай, а на чужом
          * компьютере снять её проще, чем вспомнить о ней, вводя пароль в пятый раз. Устройство
          * при этом всегда можно забыть — здесь же на экране входа и в профиле.
          */}
        <Form.Item name="rememberDevice"
          valuePropName="checked"
          initialValue={true}
          extra={
            fingerprint
              ? undefined
              : 'Быстрый вход недоступен: страница открыта без защищённого соединения'
          }
          style={{ marginBottom: 16 }}
        >
          <Checkbox disabled={!fingerprint}>Запомнить устройство и входить без пароля</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Войти
        </Button>
      </Form>
    </AuthLayout>
  );
};
