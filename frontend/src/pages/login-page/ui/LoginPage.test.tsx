import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/pages/login-page';
import { renderWithStore } from '@/test/renderWithStore';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

const loginCall = vi.fn();

vi.mock('@/entities/auth/api/authApi', () => ({
  login: (...args: unknown[]) => loginCall(...args),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  fetchMe: vi.fn()
}));

describe('LoginPage', () => {
  beforeEach(() => {
    loginCall.mockReset();
    loginCall.mockResolvedValue({ user: { id: 'u1', username: 'sber', role: 'USER', blocked: false } });
  });

  it('ведёт на регистрацию явной ссылкой', () => {
    renderWithStore(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { name: 'С возвращением' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Завести аккаунт' })).toHaveAttribute('href', '/register');
  });

  it('входит с введёнными логином и паролем', async () => {
    renderWithStore(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(loginCall).toHaveBeenCalledWith({ username: 'sber', password: 'biblioteka1' }));
  });

  /**
   * Не уточняем, что именно не подошло: ответ «логин верный, пароль нет» подсказывает
   * подбирающему, что учётная запись существует.
   */
  it('на отказ отвечает одинаково про логин и пароль', async () => {
    loginCall.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401, data: {} } }));
    renderWithStore(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'nepodhodit1');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Логин или пароль не подходят')).toBeInTheDocument();
  });
});
