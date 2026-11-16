import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from './ImportPage';
import { renderWithStore } from '@/test/renderWithStore';
import { ImportPreview } from '@/shared/types/library';

const previewImport = vi.fn();
const commitImport = vi.fn();

vi.mock('@/entities/import', () => ({
  previewImport: (...args: unknown[]) => previewImport(...args),
  commitImport: (...args: unknown[]) => commitImport(...args)
}));

const preview: ImportPreview = {
  fileName: 'goodreads_library_export.csv',
  detectedSource: 'GOODREADS',
  totalRows: 3,
  validRows: 2,
  duplicateRows: 1,
  columns: [
    { name: 'Title', target: 'Название', recognized: true, sample: 'Dune' },
    { name: 'Owned Copies', recognized: false, sample: '1' }
  ],
  rows: [
    { line: 2, title: 'Dune', authorNames: ['Frank Herbert'], errors: [], duplicates: [] },
    {
      line: 3,
      title: 'The Three-Body Problem',
      authorNames: ['Liu Cixin'],
      errors: [],
      duplicates: [
        { id: 'i-1', title: 'Задача трёх тел', authorNames: ['Лю Цысинь'], hasCover: false, reason: 'ISBN' }
      ]
    },
    { line: 4, title: undefined, authorNames: [], errors: ['Строка без названия — заводить нечего'], duplicates: [] }
  ]
};

const upload = async (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File(['Title\nDune\n'], 'goodreads_library_export.csv', { type: 'text/csv' }));
};

describe('ImportPage', () => {
  beforeEach(() => {
    previewImport.mockReset().mockResolvedValue(preview);
    commitImport.mockReset().mockResolvedValue({ imported: 1, skippedAsDuplicate: 0, failed: 0, errors: [] });
  });

  /**
   * Колонки «распознавались автоматически», и всё, что не распозналось, пропадало молча:
   * о потере узнавали, не найдя в библиотеке своих заметок.
   */
  it('называет колонки, которые не приедут', async () => {
    const { container } = renderWithStore(<ImportPage />);
    await upload(container);

    expect(await screen.findByText('Owned Copies')).toBeInTheDocument();
    expect(screen.getByText(/Серые не распознаны и не приедут: Owned Copies/)).toBeInTheDocument();
  });

  it('показывает разбор файла числами', async () => {
    const { container } = renderWithStore(<ImportPage />);
    await upload(container);

    expect(await screen.findByText('Разбор файла')).toBeInTheDocument();
    expect(screen.getByText('Заведём записей')).toBeInTheDocument();
    // Из трёх строк: одна новая, одна дубль (по умолчанию пропускается), одна с ошибкой.
    expect(screen.getByRole('button', { name: /Завести 1 запись/ })).toBeInTheDocument();
  });

  /** Совпадение — решение построчное: одна и та же книга бывает и ошибкой, и вторым изданием. */
  it('заводит дубль, только если это выбрано в строке', async () => {
    const { container } = renderWithStore(<ImportPage />);
    await upload(container);

    await userEvent.click(await screen.findByRole('button', { name: /Завести 1 запись/ }));
    await waitFor(() => expect(commitImport).toHaveBeenCalled());
    expect(commitImport.mock.calls[0][0].rows).toHaveLength(1);
    expect(commitImport.mock.calls[0][0].rows[0].line).toBe(2);
  });

  it('добавляет дубль в пачку по «Завести» в строке', async () => {
    const { container } = renderWithStore(<ImportPage />);
    await upload(container);

    // Нажимается подпись: у переключателя Ant Design сам input скрыт под ней.
    await userEvent.click(await screen.findByText('Завести', { exact: true }));

    await userEvent.click(screen.getByRole('button', { name: /Завести 2 записи/ }));
    await waitFor(() => expect(commitImport).toHaveBeenCalled());
    expect(commitImport.mock.calls[0][0].rows.map((row: { line: number }) => row.line)).toEqual([2, 3]);
  });
});
