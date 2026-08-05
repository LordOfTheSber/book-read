import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressTab } from './ProgressTab';
import { LibraryItem } from '@/shared/types/library';
import { renderWithStore } from '@/test/renderWithStore';

const addSession = vi.fn();
const fetchSessions = vi.fn();
const fetchLogs = vi.fn();

vi.mock('@/entities/book/api/progressApi', () => ({
  fetchSessions: (...args: unknown[]) => fetchSessions(...args),
  addSession: (...args: unknown[]) => addSession(...args),
  deleteSession: vi.fn(),
  fetchLogs: (...args: unknown[]) => fetchLogs(...args),
  fetchQuotes: vi.fn(),
  addQuote: vi.fn(),
  deleteQuote: vi.fn(),
  searchQuotes: vi.fn()
}));

const item = (overrides: Partial<LibraryItem> = {}): LibraryItem =>
  ({
    id: 'b-1',
    title: 'Задача трёх тел',
    status: 'READING',
    authors: [],
    hasCover: false,
    attempt: 1,
    progress: { current: 100, total: 400, unit: 'PAGES', percent: 25, remaining: 300, behindSchedule: false },
    ...overrides
  }) as LibraryItem;

describe('ProgressTab', () => {
  beforeEach(() => {
    addSession.mockReset().mockResolvedValue({});
    fetchSessions.mockReset().mockResolvedValue([]);
    fetchLogs.mockReset().mockResolvedValue([]);
  });

  it('показывает текущую позицию и остаток', async () => {
    renderWithStore(<ProgressTab item={item()} onProgressChanged={vi.fn()} />);

    expect(await screen.findByText(/100 из 400/)).toBeInTheDocument();
    expect(screen.getByText(/осталось 300/)).toBeInTheDocument();
  });

  /** Быстрое «+10» — это заход от текущей позиции, а не установка абсолютного значения. */
  it('быстрое продвижение отсчитывается от текущей позиции', async () => {
    const onProgressChanged = vi.fn();
    renderWithStore(<ProgressTab item={item()} onProgressChanged={onProgressChanged} />);

    await userEvent.click(await screen.findByRole('button', { name: /\+10/ }));

    await waitFor(() => expect(addSession).toHaveBeenCalled());
    expect(addSession.mock.calls[0][1]).toMatchObject({ fromPosition: 100, toPosition: 110 });
    await waitFor(() => expect(onProgressChanged).toHaveBeenCalled());
  });

  it('подсказывает норму в день до дедлайна', async () => {
    const withDeadline = item({
      progress: {
        current: 300,
        total: 400,
        unit: 'PAGES',
        percent: 75,
        remaining: 100,
        dailyNorm: 34,
        daysLeft: 3,
        behindSchedule: false
      }
    });

    renderWithStore(<ProgressTab item={withDeadline} onProgressChanged={vi.fn()} />);

    expect(await screen.findByText(/34 стр\. в день/)).toBeInTheDocument();
  });

  it('предупреждает об отставании от графика', async () => {
    const behind = item({
      progress: {
        current: 10,
        total: 400,
        unit: 'PAGES',
        percent: 3,
        remaining: 390,
        dailyNorm: 390,
        daysLeft: 1,
        behindSchedule: true
      }
    });

    renderWithStore(<ProgressTab item={behind} onProgressChanged={vi.fn()} />);

    expect(await screen.findByText(/Отставание от графика/)).toBeInTheDocument();
  });

  /**
   * Шаг быстрого продвижения обязан идти от единицы прогресса: «+50» — это про страницы,
   * а у сериала счёт идёт эпизодами, и «+50 эп.» отметить некому.
   */
  it('предлагает шаги по единице прогресса, а не всегда страничные', async () => {
    const anime = item({
      kind: 'ANIME',
      progress: { current: 3, total: 24, unit: 'EPISODES', percent: 13, remaining: 21, behindSchedule: false }
    });

    renderWithStore(<ProgressTab item={anime} onProgressChanged={vi.fn()} />);

    expect(await screen.findByRole('button', { name: '+1 эп.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+5 эп.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+50/ })).not.toBeInTheDocument();
  });

  /** Иначе в истории оседает заход за краем шкалы: сервер обрежет прогресс, но не заход. */
  it('не отправляет заход за пределы объёма', async () => {
    const almostDone = item({
      progress: { current: 395, total: 400, unit: 'PAGES', percent: 99, remaining: 5, behindSchedule: false }
    });

    renderWithStore(<ProgressTab item={almostDone} onProgressChanged={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '+25 стр.' }));

    await waitFor(() => expect(addSession).toHaveBeenCalled());
    expect(addSession.mock.calls[0][1]).toMatchObject({ fromPosition: 395, toPosition: 400 });
  });

  /** Без шкалы полосу рисовать не из чего — вместо неё подсказка, что делать. */
  it('подсказывает задать объём, когда шкалы нет', async () => {
    renderWithStore(<ProgressTab item={item({ progress: { behindSchedule: false } })} onProgressChanged={vi.fn()} />);

    expect(await screen.findByText(/Укажите объём в карточке/)).toBeInTheDocument();
  });
});
