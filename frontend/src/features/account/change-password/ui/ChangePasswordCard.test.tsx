import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordCard } from './ChangePasswordCard';
import { renderWithStore } from '@/test/renderWithStore';

const changeMyPassword = vi.fn();

vi.mock('@/entities/account', () => ({
  changeMyPassword: (...args: unknown[]) => changeMyPassword(...args),
  exportMyLibrary: vi.fn(),
  deleteMyAccount: vi.fn()
}));

describe('ChangePasswordCard', () => {
  beforeEach(() => {
    changeMyPassword.mockReset().mockResolvedValue(undefined);
  });

  it('меняет пароль и предупреждает, что вход слетит везде', async () => {
    renderWithStore(<ChangePasswordCard />);

    expect(screen.getByText(/сессии и запомненные устройства сбрасываются/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Текущий пароль'), 'secret123');
    await userEvent.type(screen.getByLabelText('Новый пароль'), 'newsecret1');
    await userEvent.type(screen.getByLabelText('Ещё раз'), 'newsecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }));

    await waitFor(() => expect(changeMyPassword).toHaveBeenCalledWith('secret123', 'newsecret1'));
  });

  /** Опечатка во втором поле — самая частая; ловить её должна форма, а не сервер. */
  it('не отправляет несовпавшие пароли', async () => {
    renderWithStore(<ChangePasswordCard />);

    await userEvent.type(screen.getByLabelText('Текущий пароль'), 'secret123');
    await userEvent.type(screen.getByLabelText('Новый пароль'), 'newsecret1');
    await userEvent.type(screen.getByLabelText('Ещё раз'), 'newsecret2');
    await userEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }));

    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument();
    expect(changeMyPassword).not.toHaveBeenCalled();
  });
});
