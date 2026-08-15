import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupsTab } from './BackupsTab';
import { renderWithStore } from '@/test/renderWithStore';

const listExports = vi.fn();
const uploadExport = vi.fn();
const restoreExport = vi.fn();

vi.mock('@/entities/export/api/exportApi', () => ({
  requestExport: vi.fn(),
  downloadExport: vi.fn(),
  listExports: (...args: unknown[]) => listExports(...args),
  deleteExportFile: vi.fn(),
  restoreExport: (...args: unknown[]) => restoreExport(...args),
  uploadExport: (...args: unknown[]) => uploadExport(...args)
}));

/** Восстановление перечитывает список пользователей — сеть в тесте не нужна. */
vi.mock('@/entities/user/api/userApi', () => ({
  fetchUsers: vi.fn().mockResolvedValue([]),
  updateUserSessionSettings: vi.fn(),
  clearUserSessionSettings: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserBlockedStatus: vi.fn()
}));

describe('BackupsTab', () => {
  beforeEach(() => {
    listExports.mockReset();
    uploadExport.mockReset();
    restoreExport.mockReset();
    listExports.mockResolvedValue([
      { fileName: 'export-2025-01-01_02-00-00.json', sizeBytes: 2048, lastModifiedAt: '2025-01-01T02:00:00Z' }
    ]);
  });

  it('загружает принесённую копию и обновляет список', async () => {
    uploadExport.mockResolvedValue({
      fileName: 'backup.json',
      sizeBytes: 1024,
      lastModifiedAt: '2025-02-01T10:00:00Z'
    });

    renderWithStore(<BackupsTab />);
    await screen.findByText('export-2025-01-01_02-00-00.json');

    const file = new File(['{"schemaVersion":2}'], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => expect(uploadExport).toHaveBeenCalledWith(file));
    // Список перечитывается: загруженная копия должна быть видна там же, где снятые здесь.
    await waitFor(() => expect(listExports).toHaveBeenCalledTimes(2));
  });

  /** Разделов в копии два десятка, и сводка должна называть их, а не три знакомых числа. */
  it('показывает разбивку восстановления по разделам', async () => {
    restoreExport.mockResolvedValue({
      fileName: 'export-2025-01-01_02-00-00.json',
      schemaVersion: 2,
      restoredUsers: 2,
      restoredItems: 3,
      restoredBookTypes: 1,
      restoredSources: 0,
      restoredSystemNodes: 0,
      restoredSessions: 0,
      counts: { users: 2, libraryItems: 3, quotes: 5, sources: 0 }
    });

    renderWithStore(<BackupsTab />);
    await screen.findByText('export-2025-01-01_02-00-00.json');

    await userEvent.click(screen.getByLabelText('Восстановить'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Восстановить' }));

    await waitFor(() =>
      expect(screen.getByText('Восстановлено: пользователей 2, произведений 3, выписок 5')).toBeInTheDocument()
    );
    // Пустой раздел в сводку не попадает: перечислять нули — значит прятать в них непустые.
    expect(screen.queryByText(/источников/)).not.toBeInTheDocument();
  });
});
