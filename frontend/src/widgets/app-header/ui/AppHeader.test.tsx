import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      <AppHeader
        onOpenSearch={handlers.onOpenSearch ?? (() => undefined)}
        onCreateRecord={handlers.onCreateRecord ?? (() => undefined)}
      />
    </ThemeProvider>,
    store,
    { route: path }
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
    expect(screen.getByText('Наборы и справочники')).toBeInTheDocument();
    // Четыре справочника съехались на одну страницу и стоят в меню одним пунктом.
    expect(screen.getByRole('menuitem', { name: 'Справочники' })).toBeInTheDocument();
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

  /**
   * Меню собраны своим содержимым, а не списком Ant Design: без ручного закрытия они
   * оставались висеть поверх новой страницы после перехода по ссылке внутри них.
   */
  it('меню «Ещё» закрывается, когда из него перешли в раздел', async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /Ещё/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Выписки' }));

    await waitFor(() => expect(screen.queryByText('Каждую неделю')).not.toBeVisible());
  });

  it('меню профиля закрывается по переходу, но остаётся открытым при выборе темы', async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Меню профиля' }));
    await userEvent.click(await screen.findByRole('button', { name: /Ночь/ }));
    expect(screen.getByText('Тема')).toBeVisible();

    await userEvent.click(screen.getByRole('link', { name: 'Профиль' }));

    await waitFor(() => expect(screen.getByText('Тема')).not.toBeVisible());
  });

  it('тема переехала в меню профиля и не занимает место в шапке', async () => {
    renderHeader();

    expect(screen.queryByText('Тема')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Меню профиля' }));

    expect(await screen.findByText('Тема')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ночь/ })).toBeInTheDocument();
  });
});
