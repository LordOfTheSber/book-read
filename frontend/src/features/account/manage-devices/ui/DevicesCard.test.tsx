import React from 'react';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '@/test/renderWithStore';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { resetDeviceFingerprintCache } from '@/shared/lib/deviceFingerprint';
import { DevicesCard } from './DevicesCard';

const listCall = vi.fn();
const revokeCall = vi.fn();
const revokeAllCall = vi.fn();

vi.mock('@/entities/auth/api/authApi', () => ({
  fetchTrustedDevices: (...args: unknown[]) => listCall(...args),
  revokeTrustedDevice: (...args: unknown[]) => revokeCall(...args),
  revokeAllTrustedDevices: (...args: unknown[]) => revokeAllCall(...args)
}));

const devices = [
  {
    id: 'd1',
    label: 'Chrome · Windows',
    lastIp: '10.0.0.1',
    lastUsedAt: '2026-08-20T10:00:00Z',
    expiresAt: '2026-11-20T10:00:00Z',
    current: true
  },
  {
    id: 'd2',
    label: 'Safari · iPhone',
    lastUsedAt: '2026-08-01T10:00:00Z',
    expiresAt: '2026-11-01T10:00:00Z',
    current: false
  }
];

const renderCard = () =>
  renderWithStore(
    <ThemeProvider>
      <App>
        <DevicesCard />
      </App>
    </ThemeProvider>
  );

describe('DevicesCard', () => {
  beforeEach(() => {
    listCall.mockReset();
    revokeCall.mockReset();
    revokeAllCall.mockReset();
    localStorage.clear();
    resetDeviceFingerprintCache();
    listCall.mockResolvedValue(devices);
    revokeCall.mockResolvedValue(undefined);
    revokeAllCall.mockResolvedValue(undefined);
  });

  /** Из списка должно быть видно, какое устройство своё: его отключение — отдельное решение. */
  it('показывает устройства и отмечает текущее', async () => {
    renderCard();

    expect(await screen.findByText('Chrome · Windows')).toBeInTheDocument();
    expect(screen.getByText('Safari · iPhone')).toBeInTheDocument();
    expect(screen.getByText('это устройство')).toBeInTheDocument();
  });

  it('отключает устройство и убирает его из списка', async () => {
    renderCard();

    const row = (await screen.findByText('Safari · iPhone')).closest('li') as HTMLElement;
    await userEvent.click(within(row).getByRole('button'));
    await userEvent.click(await screen.findByRole('button', { name: 'Отключить' }));

    await waitFor(() => expect(revokeCall).toHaveBeenCalledWith('d2', expect.any(String)));
    await waitFor(() => expect(screen.queryByText('Safari · iPhone')).not.toBeInTheDocument());
  });

  it('пустой список объясняет, откуда берутся устройства', async () => {
    listCall.mockResolvedValue([]);
    renderCard();

    expect(
      await screen.findByText('Пока ни одного: отметьте «запомнить устройство» при следующем входе')
    ).toBeInTheDocument();
  });
});
