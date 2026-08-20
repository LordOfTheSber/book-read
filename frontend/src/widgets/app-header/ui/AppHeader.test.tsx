import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { User, UserRole } from '@/shared/types/library';

const makeUser = (role: UserRole): User => ({
  id: 'u1',
  username: 'sber',
  role,
  blocked: false
});

const renderHeader = (
  role: UserRole = 'USER',
  handlers: { onOpenSearch?: () => void; onCreateRecord?: () => void } = {},
  path = '/'
) => {
  const store = createTestStore({
    auth: { user: makeUser(role), authenticated: true, loadingUser: false, updatingAvatar: false }
  });

  return renderWithStore(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppHeader
          onOpenSearch={handlers.onOpenSearch ?? (() => undefined)}
          onCreateRecord={handlers.onCreateRecord ?? (() => undefined)}
        />
      </MemoryRouter>
    </ThemeProvider>,
    store
  );
};

describe('AppHeader', () => {
  it('держит наверху три раздела, остальное — под «Ещё»', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: 'Библиотека' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Аналитика' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Лента' })).toBeInTheDocument();
    // Справочники наверху не стоят: до перестройки они занимали место наравне с библиотекой.
    expect(screen.queryByRole('link', { name: 'Источники' })).not.toBeInTheDocument();
  });

  it('открытый раздел подсвечен, даже когда он спрятан в «Ещё»', async () => {
    renderHeader('USER', {}, '/quotes');

    const more = screen.getByRole('button', { name: /Ещё/ });
    await userEvent.click(more);

    expect(await screen.findByRole('menuitem', { name: 'Выписки' })).toBeInTheDocument();
  });

  it('«Ещё» раскладывает разделы по группам с подписями', async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /Ещё/ }));

    expect(await screen.findByText('Каждую неделю')).toBeInTheDocument();
    expect(screen.getByText('Действия')).toBeInTheDocument();
    expect(screen.getByText('Справочники')).toBeInTheDocument();
    // Администрирования у обычного пользователя нет вовсе — пустой группы тоже.
    expect(screen.queryByText('Администрирование')).not.toBeInTheDocument();
  });

  it('администратору показывает свою группу разделов', async () => {
    renderHeader('ADMIN');

    await userEvent.click(screen.getByRole('button', { name: /Ещё/ }));

    expect(await screen.findByText('Администрирование')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Узлы' })).toBeInTheDocument();
  });

  it('добавление доступно прямо из шапки: со страницы аналитики за ним не надо возвращаться', async () => {
    const onCreateRecord = vi.fn();
    renderHeader('USER', { onCreateRecord }, '/analytics');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить запись' }));

    expect(onCreateRecord).toHaveBeenCalled();
  });

  it('поиск открывается из шапки', async () => {
    const onOpenSearch = vi.fn();
    renderHeader('USER', { onOpenSearch });

    await userEvent.click(screen.getByText('Поиск по книгам, авторам, выпискам'));

    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('тема переехала в меню профиля и не занимает место в шапке', async () => {
    renderHeader();

    expect(screen.queryByText('Тема')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Меню профиля' }));

    expect(await screen.findByText('Тема')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Тёмная/ })).toBeInTheDocument();
  });
});
