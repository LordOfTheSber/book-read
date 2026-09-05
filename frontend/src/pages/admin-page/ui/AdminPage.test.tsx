import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import type { SystemNode } from '@/shared/types/library';

const fetchNodes = vi.fn();
const listExports = vi.fn();
const updateSessionSettings = vi.fn();

vi.mock('@/entities/node/api/nodeApi', () => ({
  fetchNodes: (...args: unknown[]) => fetchNodes(...args),
  fetchNodeById: vi.fn(),
  fetchNodeMemoryDetail: vi.fn(),
  downloadNodeLogs: vi.fn()
}));

vi.mock('@/entities/user/api/userApi', () => ({
  fetchUsers: vi.fn().mockResolvedValue([
    { id: 'u-1', username: 'sber', role: 'SUPER_ADMIN', blocked: false, createdAt: '2026-01-01T10:00:00Z' },
    {
      id: 'u-2',
      username: 'anna',
      role: 'USER',
      blocked: true,
      createdAt: '2026-02-01T10:00:00Z',
      sessionTtlOverrideMinutes: 480
    }
  ]),
  updateUserSessionSettings: vi.fn(),
  clearUserSessionSettings: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserBlockedStatus: vi.fn()
}));

vi.mock('@/entities/export/api/exportApi', () => ({
  requestExport: vi.fn(),
  downloadExport: vi.fn(),
  listExports: (...args: unknown[]) => listExports(...args),
  deleteExportFile: vi.fn(),
  restoreExport: vi.fn(),
  uploadExport: vi.fn()
}));

vi.mock('@/entities/session-settings/api/sessionSettingsApi', () => ({
  fetchSessionSettings: vi.fn().mockResolvedValue({ sessionTtlMinutes: 120, maxSessionLifetimeMinutes: 43_200 }),
  updateSessionSettings: (...args: unknown[]) => updateSessionSettings(...args)
}));

const node = (overrides: Partial<SystemNode> = {}): SystemNode =>
  ({
    id: 'n-1',
    nodeKey: 'node-1',
    ip: '10.0.0.11',
    cpuLoad: 0.18,
    systemMemoryTotal: 100,
    systemMemoryFree: 46,
    diskTotal: 100,
    diskFree: 32,
    heapUsed: 41,
    heapMax: 100,
    uptimeSeconds: 3_600,
    lastReportedAt: new Date().toISOString(),
    ...overrides
  }) as SystemNode;

const superAdminStore = () =>
  createTestStore({
    auth: {
      authenticated: true,
      user: { id: 'u-1', username: 'sber', role: 'SUPER_ADMIN', blocked: false },
      loadingUser: false,
      updatingAvatar: false
    }
  });

const renderPage = () => renderWithStore(<AdminPage />, superAdminStore(), { route: '/admin' });

/** Плитка сводки — группа со своим именем: те же проценты стоят ещё и в метриках узла. */
const tile = (label: string) => screen.getByRole('group', { name: label });

describe('AdminPage', () => {
  beforeEach(() => {
    fetchNodes.mockReset().mockResolvedValue([node(), node({ id: 'n-2', nodeKey: 'node-2', lastReportedAt: '2026-01-01T00:00:00Z' })]);
    listExports
      .mockReset()
      .mockResolvedValue([
        { fileName: 'export-2026-08-21_02-00-00.json', sizeBytes: 54_000_000, lastModifiedAt: new Date().toISOString() }
      ]);
    updateSessionSettings.mockReset().mockResolvedValue({
      sessionTtlMinutes: 30,
      maxSessionLifetimeMinutes: 43_200
    });
  });

  /** Сводка отвечает «всё ли в порядке» до того, как открыта хоть одна вкладка. */
  it('показывает состояние узлов, людей и копий сверху', async () => {
    renderPage();

    await screen.findByText('node-2 молчит');
    expect(within(tile('Узлы')).getByText('1 из 2')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 заблокирован')).toBeInTheDocument());
    expect(within(tile('Место на диске')).getByText('68%')).toBeInTheDocument();
  });

  it('узлы и копии стоят рядом на обзоре, а не двумя пунктами меню', async () => {
    renderPage();

    expect(await screen.findByText('node-1')).toBeInTheDocument();
    expect(screen.getByText('export-2026-08-21_02-00-00.json')).toBeInTheDocument();
  });

  /** Минуты в форме сессий ни о чём не говорят: рядом с числом стоит его человеческий срок. */
  it('на вкладке сессий показывает сроки словами и сохраняет пресет', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Сессии' }));

    // Последствия числа сказаны словами прямо под формой, а не спрятаны в подсказке.
    expect(await screen.findByText(/через 30 дней вход спросят снова/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '30 минут' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(updateSessionSettings).toHaveBeenCalledWith({
        sessionTtlMinutes: 30,
        maxSessionLifetimeMinutes: 43_200
      })
    );
  });

  /** Персональные сроки раньше были видны только в чужой карточке — теперь они списком. */
  it('собирает исключения по сессиям в один список', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Сессии' }));

    expect(await screen.findByText('У кого не как у всех')).toBeInTheDocument();
    expect(screen.getByText('anna')).toBeInTheDocument();
    expect(screen.getByText('8 часов · своё')).toBeInTheDocument();
  });
});
