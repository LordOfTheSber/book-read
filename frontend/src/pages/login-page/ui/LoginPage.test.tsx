import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/pages/login-page';
import { renderWithStore } from '@/test/renderWithStore';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { suppressQuickLogin } from '@/shared/api/authSession';
import { resetDeviceFingerprintCache } from '@/shared/lib/deviceFingerprint';

const loginCall = vi.fn();
const deviceHintCall = vi.fn();
const deviceLoginCall = vi.fn();
const forgetDeviceCall = vi.fn();

vi.mock('@/entities/auth/api/authApi', () => ({
  login: (...args: unknown[]) => loginCall(...args),
  register: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  uploadAvatar: vi.fn(),
  fetchDeviceHint: (...args: unknown[]) => deviceHintCall(...args),
  loginByDevice: (...args: unknown[]) => deviceLoginCall(...args),
  forgetThisDevice: (...args: unknown[]) => forgetDeviceCall(...args),
  fetchTrustedDevices: vi.fn(),
  revokeTrustedDevice: vi.fn(),
  revokeAllTrustedDevices: vi.fn()
}));

const user = { id: 'u1', username: 'sber', role: 'USER', blocked: false };

/**
 * Отпечаток считается асинхронно, и до его готовности галочка выключена: обещать быстрый вход,
 * не зная, будет ли чем опознать устройство, нельзя. Клик по выключенной галочке не проходит,
 * поэтому тесты про неё ждут готовности, а не полагаются на скорость машины.
 */
const waitForFingerprint = () =>
  waitFor(() => expect(screen.getByRole('checkbox', { name: /Запомнить устройство/ })).toBeEnabled());

const renderPage = () =>
  renderWithStore(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>
  );

describe('LoginPage', () => {
  beforeEach(() => {
    loginCall.mockReset();
    deviceHintCall.mockReset();
    deviceLoginCall.mockReset();
    forgetDeviceCall.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    resetDeviceFingerprintCache();
    loginCall.mockResolvedValue({ user });
    deviceHintCall.mockResolvedValue(undefined);
    deviceLoginCall.mockResolvedValue({ user });
    forgetDeviceCall.mockResolvedValue(undefined);
  });

  it('ведёт на регистрацию явной ссылкой', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'С возвращением' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Завести аккаунт' })).toHaveAttribute('href', '/register');
  });

  it('входит с введёнными логином и паролем', async () => {
    renderPage();
    await waitForFingerprint();

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(loginCall).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'sber', password: 'biblioteka1', rememberDevice: true })
      )
    );
  });

  /** Снятая галочка — единственное, что отделяет чужой компьютер от входа без пароля. */
  it('не запоминает устройство со снятой галочкой', async () => {
    renderPage();
    await waitForFingerprint();

    await userEvent.click(screen.getByRole('checkbox', { name: /Запомнить устройство/ }));
    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(loginCall).toHaveBeenCalledWith(expect.objectContaining({ rememberDevice: false }))
    );
  });

  /** Ради этого всё и затевалось: знакомое устройство входит само, без единого нажатия. */
  it('входит сам, когда устройство узнают', async () => {
    deviceHintCall.mockResolvedValue({
      username: 'sber',
      deviceLabel: 'Chrome · Windows',
      lastUsedAt: '2026-08-01T10:00:00Z'
    });

    renderPage();

    await waitFor(() => expect(deviceLoginCall).toHaveBeenCalledTimes(1));
    expect(deviceLoginCall.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/);
  });

  /** После явного выхода вход сам не повторяется — иначе выйти было бы нельзя. */
  it('после выхода ждёт нажатия, а не входит сам', async () => {
    suppressQuickLogin();
    deviceHintCall.mockResolvedValue({
      username: 'sber',
      displayName: 'Алексей',
      deviceLabel: 'Chrome · Windows',
      lastUsedAt: '2026-08-01T10:00:00Z'
    });

    renderPage();

    const button = await screen.findByRole('button', { name: 'Продолжить как sber' });
    expect(deviceLoginCall).not.toHaveBeenCalled();

    await userEvent.click(button);
    await waitFor(() => expect(deviceLoginCall).toHaveBeenCalledTimes(1));
  });

  it('забывает устройство по кнопке «это не я»', async () => {
    suppressQuickLogin();
    deviceHintCall.mockResolvedValue({
      username: 'sber',
      deviceLabel: 'Chrome · Windows',
      lastUsedAt: '2026-08-01T10:00:00Z'
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Это не я — забыть устройство' }));

    await waitFor(() => expect(forgetDeviceCall).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /Продолжить как/ })).not.toBeInTheDocument();
  });

  /** Отозванное с другого экрана устройство возвращает к форме, а не в тупик. */
  it('возвращает к паролю, когда устройство больше не узнают', async () => {
    deviceHintCall.mockResolvedValue({
      username: 'sber',
      deviceLabel: 'Chrome · Windows',
      lastUsedAt: '2026-08-01T10:00:00Z'
    });
    deviceLoginCall.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401, data: {} } }));

    renderPage();

    await waitFor(() => expect(deviceLoginCall).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Продолжить как/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  /**
   * Не уточняем, что именно не подошло: ответ «логин верный, пароль нет» подсказывает
   * подбирающему, что учётная запись существует.
   */
  it('на отказ отвечает одинаково про логин и пароль', async () => {
    loginCall.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401, data: {} } }));
    renderPage();

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'nepodhodit1');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Логин или пароль не подходят')).toBeInTheDocument();
  });
});
