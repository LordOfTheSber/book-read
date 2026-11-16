import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyDataCard } from './MyDataCard';
import { renderWithStore } from '@/test/renderWithStore';
import { markAuthSessionActive, isAuthSessionActive } from '@/shared/api/authSession';

const exportMyLibrary = vi.fn();
const deleteMyAccount = vi.fn();
const navigate = vi.fn();

vi.mock('@/entities/account', () => ({
  exportMyLibrary: (...args: unknown[]) => exportMyLibrary(...args),
  deleteMyAccount: (...args: unknown[]) => deleteMyAccount(...args)
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('MyDataCard', () => {
  beforeEach(() => {
    [exportMyLibrary, deleteMyAccount, navigate].forEach((mock) => mock.mockReset());
    exportMyLibrary.mockResolvedValue(new Blob(['title\n']));
    deleteMyAccount.mockResolvedValue(undefined);
    localStorage.clear();
    window.URL.createObjectURL = vi.fn(() => 'blob:preview');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('скачивает выгрузку в выбранном формате', async () => {
    const user = userEvent.setup();
    renderWithStore(<MyDataCard />);

    await user.click(screen.getByRole('button', { name: /Скачать CSV/ }));

    await waitFor(() => expect(exportMyLibrary).toHaveBeenCalledWith('csv'));
  });

  /** Пароль спрашивается заново: открытая сессия — это ещё и чужой ноутбук. */
  it('не удаляет аккаунт без пароля и слова подтверждения', async () => {
    const user = userEvent.setup();
    renderWithStore(<MyDataCard />);

    await user.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    await user.click(await screen.findByRole('button', { name: 'Удалить аккаунт' }));

    expect(await screen.findByText('Подтвердите удаление паролем')).toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it('требует ввести слово подтверждения целиком', async () => {
    const user = userEvent.setup();
    renderWithStore(<MyDataCard />);

    await user.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    await user.type(await screen.findByPlaceholderText('Ваш пароль'), 'secret');
    await user.type(screen.getByLabelText(/Введите «УДАЛИТЬ»/), 'удалить');
    await user.click(screen.getByRole('button', { name: 'Удалить аккаунт' }));

    expect(await screen.findByText('Введите «УДАЛИТЬ» без кавычек')).toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  /** После удаления флаг сессии надо снять, иначе роутер попробует восстановить вход и получит 401. */
  it('удаляет аккаунт, сбрасывает признак сессии и уводит на вход', async () => {
    markAuthSessionActive();
    const user = userEvent.setup();
    renderWithStore(<MyDataCard />);

    await user.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    await user.type(await screen.findByPlaceholderText('Ваш пароль'), 'secret');
    await user.type(screen.getByLabelText(/Введите «УДАЛИТЬ»/), 'УДАЛИТЬ');
    await user.click(screen.getByRole('button', { name: 'Удалить аккаунт' }));

    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledWith('secret'));
    expect(isAuthSessionActive()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
