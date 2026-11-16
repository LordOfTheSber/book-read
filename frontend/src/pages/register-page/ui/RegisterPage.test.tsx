import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from '@/pages/register-page';
import { renderWithStore } from '@/test/renderWithStore';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

const registerCall = vi.fn();

vi.mock('@/entities/auth/api/authApi', () => ({
  login: vi.fn(),
  register: (...args: unknown[]) => registerCall(...args),
  logout: vi.fn(),
  refresh: vi.fn(),
  fetchMe: vi.fn()
}));

const taken = Object.assign(new Error('Request failed'), {
  response: { status: 400, data: { message: 'Username already exists' } }
});

describe('RegisterPage', () => {
  beforeEach(() => {
    registerCall.mockReset();
    registerCall.mockResolvedValue({ user: { id: 'u1', username: 'sber', role: 'USER', blocked: false } });
  });

  it('правила пароля отмечаются по мере набора, а не после отправки', async () => {
    renderWithStore(
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    );

    const rule = screen.getByText('От 8 знаков');
    expect(rule).toBeInTheDocument();
    expect(screen.getByText('Буквы и хотя бы одна цифра')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');

    // Правило отмечено — значит подсказка живая, а не статичный текст.
    await waitFor(() => expect(screen.getByText('Без пробелов')).toBeInTheDocument());
  });

  it('не отправляет пароль, который не отвечает требованиям', async () => {
    renderWithStore(
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'korotko');
    await userEvent.type(screen.getByLabelText('Повторите пароль'), 'korotko');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Проверьте требования ниже')).toBeInTheDocument();
    expect(registerCall).not.toHaveBeenCalled();
  });

  /** Ошибка стоит у второго поля, а не общей строкой сверху: чинить нужно именно его. */
  it('несовпадение паролей показывается у второго поля', async () => {
    renderWithStore(
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.type(screen.getByLabelText('Повторите пароль'), 'biblioteka2');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Второй пароль отличается от первого')).toBeInTheDocument();
    expect(registerCall).not.toHaveBeenCalled();
  });

  it('заводит аккаунт, когда всё сошлось', async () => {
    renderWithStore(
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    );

    // Отпечаток считается асинхронно: до его готовности устройство запомнить не просят.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Запомнить устройство/ })).toBeEnabled()
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.type(screen.getByLabelText('Повторите пароль'), 'biblioteka1');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() =>
      expect(registerCall).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'sber', password: 'biblioteka1', rememberDevice: true })
      )
    );
  });

  /**
   * Занятый логин — ошибка одного поля: подсветив его, форма оставляет набранный пароль
   * на месте, вместо того чтобы просить ввести всё заново.
   */
  it('занятый логин подсвечивает поле и не стирает пароль', async () => {
    registerCall.mockRejectedValue(taken);
    renderWithStore(
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    );

    await userEvent.type(screen.getByLabelText('Логин'), 'sber');
    await userEvent.type(screen.getByLabelText('Пароль'), 'biblioteka1');
    await userEvent.type(screen.getByLabelText('Повторите пароль'), 'biblioteka1');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Такой логин уже есть')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('biblioteka1');
  });
});
