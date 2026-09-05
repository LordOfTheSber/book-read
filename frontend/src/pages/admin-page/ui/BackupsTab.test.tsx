import React from 'react';
import { screen, waitFor } from '@testing-library/react';
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
    // Список перечитывается: принесённая копия должна быть видна там же, где снятые здесь.
    await waitFor(() => expect(listExports).toHaveBeenCalledTimes(2));
  });

  /**
   * Восстановление затирает базу всех пользователей и не отменяется ничем: одного нажатия
   * для него мало, поэтому кнопка оживает только после набранного слова.
   */
  it('не разворачивает копию, пока слово не набрано целиком', async () => {
    renderWithStore(<BackupsTab />);
    await screen.findByText('export-2025-01-01_02-00-00.json');

    await userEvent.click(screen.getByLabelText('Восстановить'));

    const confirm = await screen.findByLabelText('Подтверждение восстановления');
    expect(screen.getByRole('button', { name: 'Развернуть' })).toBeDisabled();

    await userEvent.type(confirm, 'ВОССТАНО');
    expect(screen.getByRole('button', { name: 'Развернуть' })).toBeDisabled();
    expect(restoreExport).not.toHaveBeenCalled();
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
    await userEvent.type(await screen.findByLabelText('Подтверждение восстановления'), 'ВОССТАНОВИТЬ');
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть' }));

    await waitFor(() =>
      expect(screen.getByText('Восстановлено: пользователей 2, произведений 3, выписок 5')).toBeInTheDocument()
    );
    // Пустой раздел в сводку не попадает: перечислять нули — значит прятать в них непустые.
    expect(screen.queryByText(/источников/)).not.toBeInTheDocument();
  });

  /** Ночная копия отличается от снятой руками только временем — и это видно в списке. */
  it('помечает, откуда взялась копия', async () => {
    listExports.mockResolvedValue([
      { fileName: 'export-2025-01-01_02-00-00.json', sizeBytes: 2048, lastModifiedAt: '2025-01-01T02:00:00Z' },
      { fileName: 'export-2025-01-02_18-12-00.json', sizeBytes: 2048, lastModifiedAt: '2025-01-02T18:12:00Z' },
      { fileName: 'before-import.json', sizeBytes: 1024, lastModifiedAt: '2025-01-03T09:30:00Z' }
    ]);

    renderWithStore(<BackupsTab />);

    expect(await screen.findByText('ночная')).toBeInTheDocument();
    expect(screen.getByText('вручную')).toBeInTheDocument();
    expect(screen.getByText('принесена')).toBeInTheDocument();
  });
});
