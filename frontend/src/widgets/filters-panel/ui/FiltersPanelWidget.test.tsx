import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FiltersPanelWidget } from '@/widgets/filters-panel';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import { User, UserRole } from '@/shared/types/library';

const user = (id: string, username: string, role: UserRole): User => ({ id, username, role, blocked: false });

const storeAs = (role: UserRole) =>
  createTestStore({
    auth: { user: user('u-1', 'alex', role), authenticated: true, loadingUser: false, updatingAvatar: false },
    users: { list: [user('u-2', 'boris', 'USER')], loading: false, loaded: true }
  });

describe('FiltersPanelWidget', () => {
  it('применяет статус и возвращает выдачу на первую страницу', async () => {
    const store = storeAs('USER');
    store.dispatch({ type: 'bookFilters/setFilters', payload: { page: 4 } });
    const onClose = vi.fn();

    renderWithStore(<FiltersPanelWidget open onClose={onClose} />, store);

    await userEvent.click(screen.getByText('Читаю'));
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => expect(store.getState().bookFilters.status).toBe('READING'));
    // Иначе после сужения фильтра пользователь остался бы на несуществующей странице.
    expect(store.getState().bookFilters.page).toBe(0);
    expect(onClose).toHaveBeenCalled();
  });

  /** Чипы статуса — кнопки, а не подписи: до этого выбрать статус с клавиатуры было нельзя. */
  it('позволяет выбрать статус с клавиатуры', async () => {
    const store = storeAs('USER');

    renderWithStore(<FiltersPanelWidget open onClose={vi.fn()} />, store);

    const chip = screen.getByRole('button', { name: 'Читаю' });
    chip.focus();
    expect(chip).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => expect(store.getState().bookFilters.status).toBe('READING'));
  });

  it('не отправляет пустой статус: «Любой» означает отсутствие фильтра', async () => {
    const store = storeAs('USER');
    store.dispatch({ type: 'bookFilters/setFilters', payload: { status: 'READING' } });

    renderWithStore(<FiltersPanelWidget open onClose={vi.fn()} />, store);

    await userEvent.click(screen.getByText('Любой'));
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => expect(store.getState().bookFilters.status).toBeUndefined());
  });

  it('сбрасывает фильтры к состоянию по умолчанию', async () => {
    const store = storeAs('USER');
    store.dispatch({ type: 'bookFilters/setFilters', payload: { status: 'READING', favorite: true, page: 2 } });

    renderWithStore(<FiltersPanelWidget open onClose={vi.fn()} />, store);

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    await waitFor(() => expect(store.getState().bookFilters).toEqual({ page: 0, size: 10, sort: 'updatedAt,desc' }));
  });

  /** Чужие библиотеки видит только администратор — фильтр по пользователю остальным не показываем. */
  it('прячет фильтр по пользователю от обычной роли', () => {
    renderWithStore(<FiltersPanelWidget open onClose={vi.fn()} />, storeAs('USER'));

    expect(screen.queryByText('Пользователь')).not.toBeInTheDocument();
  });

  it('показывает фильтр по пользователю администратору', () => {
    renderWithStore(<FiltersPanelWidget open onClose={vi.fn()} />, storeAs('ADMIN'));

    expect(screen.getByText('Пользователь')).toBeInTheDocument();
  });
});
