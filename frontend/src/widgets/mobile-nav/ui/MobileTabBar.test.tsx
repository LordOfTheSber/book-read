import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from './MobileTabBar';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { User } from '@/shared/types/library';

const user: User = { id: 'u1', username: 'sber', role: 'USER', blocked: false };

const renderBar = (handlers: { onOpenMore?: () => void; onCreateRecord?: () => void } = {}, path = '/') =>
  renderWithStore(
    <MobileTabBar
      moreOpen={false}
      onOpenMore={handlers.onOpenMore ?? (() => undefined)}
      onCreateRecord={handlers.onCreateRecord ?? (() => undefined)}
    />,
    createTestStore({ auth: { user, authenticated: true, loadingUser: false, updatingAvatar: false } }),
    { route: path }
  );

describe('MobileTabBar', () => {
  /** Раньше все разделы прятались под гамбургером в дальнем от пальца углу экрана. */
  it('держит разделы внизу, под большим пальцем', () => {
    renderBar();

    expect(screen.getByRole('link', { name: /Библиотека/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Лента/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Аналитика/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ещё/ })).toBeInTheDocument();
  });

  it('открытый раздел помечен для чтения с экрана', () => {
    renderBar({}, '/analytics');

    expect(screen.getByRole('link', { name: /Аналитика/ })).toHaveAttribute('aria-current', 'page');
  });

  it('«+» посередине добавляет запись, «Ещё» открывает остальные разделы', async () => {
    const onCreateRecord = vi.fn();
    const onOpenMore = vi.fn();
    renderBar({ onCreateRecord, onOpenMore });

    await userEvent.click(screen.getByRole('button', { name: 'Добавить запись' }));
    await userEvent.click(screen.getByRole('button', { name: /Ещё/ }));

    expect(onCreateRecord).toHaveBeenCalled();
    expect(onOpenMore).toHaveBeenCalled();
  });
});
