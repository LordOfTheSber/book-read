import React from 'react';
import { Form } from 'antd';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordState } from '@/widgets/record-state';
import { LibraryItem } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const addSession = vi.fn();

vi.mock('@/entities/book/api/progressApi', () => ({
  fetchSessions: vi.fn().mockResolvedValue([]),
  fetchLogs: vi.fn().mockResolvedValue([]),
  addSession: (...args: unknown[]) => addSession(...args),
  deleteSession: vi.fn()
}));

vi.mock('@/entities/book/api/bookApi', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  uploadCover: vi.fn(),
  uploadCoverFromUrl: vi.fn(),
  deleteCover: vi.fn(),
  bulkUpdateBooks: vi.fn(),
  findDuplicates: vi.fn().mockResolvedValue([]),
  coverUrl: (id: string) => `/api/v1/items/${id}/cover`
}));

const reading = {
  id: 'b-1',
  title: 'Задача трёх тел',
  status: 'READING',
  favorite: false,
  wishlist: false,
  attempt: 1,
  authors: [],
  tags: [],
  shelves: [],
  hasCover: false,
  startedAt: '2026-03-12',
  progress: { current: 212, total: 400, unit: 'PAGES', percent: 53, remaining: 188, behindSchedule: false }
} as unknown as LibraryItem;

const renderState = (item: LibraryItem, onProgressChanged = vi.fn()) => {
  const Harness: React.FC = () => {
    const [form] = Form.useForm();
    return (
      <Form form={form} component={false} layout="vertical" initialValues={{ status: item.status }}>
        <RecordState
          item={item}
          title={item.title}
          kind={item.kind}
          onProgressChanged={onProgressChanged}
          onOpenSessions={vi.fn()}
        />
      </Form>
    );
  };
  return renderWithStore(<Harness />);
};

describe('RecordState', () => {
  beforeEach(() => {
    addSession.mockReset();
    addSession.mockResolvedValue({});
  });

  it('показывает позицию, объём и долю прочитанного', () => {
    renderState(reading);

    expect(screen.getByText('212')).toBeInTheDocument();
    expect(screen.getByText('/ 400 стр.')).toBeInTheDocument();
    expect(screen.getByText('53%')).toBeInTheDocument();
  });

  it('быстрый шаг отмечает заход от текущей позиции', async () => {
    const onProgressChanged = vi.fn();
    renderState(reading, onProgressChanged);

    await userEvent.click(screen.getByRole('button', { name: '+10' }));

    await waitFor(() => expect(addSession).toHaveBeenCalledWith('b-1', { fromPosition: 212, toPosition: 222 }));
    await waitFor(() => expect(onProgressChanged).toHaveBeenCalled());
  });

  /** Позицию за краем шкалы сервер всё равно обрежет — незачем сохранять её в истории. */
  it('не даёт шагнуть за конец шкалы', async () => {
    const done = { ...reading, progress: { ...reading.progress, current: 400, percent: 100, remaining: 0 } } as LibraryItem;
    renderState(done);

    await userEvent.click(screen.getByRole('button', { name: '+10' }));

    expect(addSession).not.toHaveBeenCalled();
  });

  it('норма в день появляется только при заданном сроке', () => {
    const { unmount } = renderState(reading);
    expect(screen.queryByText('Норма')).not.toBeInTheDocument();
    unmount();

    const withDeadline = {
      ...reading,
      deadline: '2026-09-30',
      progress: { ...reading.progress, dailyNorm: 12, daysLeft: 16 }
    } as LibraryItem;
    renderState(withDeadline);

    expect(screen.getByText('Норма')).toBeInTheDocument();
    expect(screen.getByText('12 стр./день')).toBeInTheDocument();
  });

  it('у записи без шкалы нет ни полосы, ни быстрых шагов', () => {
    const planned = { ...reading, progress: undefined } as LibraryItem;
    renderState(planned);

    expect(screen.queryByRole('button', { name: '+10' })).not.toBeInTheDocument();
    expect(screen.getByText('Статус')).toBeInTheDocument();
  });
});
