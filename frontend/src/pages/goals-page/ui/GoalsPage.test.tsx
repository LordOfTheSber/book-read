import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsPage } from './GoalsPage';
import { renderWithStore } from '@/test/renderWithStore';
import { ReadingGoal, Streak, YearInReview } from '@/shared/types/library';

const fetchGoal = vi.fn();
const fetchStreak = vi.fn();
const fetchAchievements = vi.fn();
const fetchYearInReview = vi.fn();

vi.mock('@/entities/engagement', () => ({
  fetchGoal: (...args: unknown[]) => fetchGoal(...args),
  fetchGoals: vi.fn(),
  saveGoal: vi.fn(),
  deleteGoal: vi.fn(),
  resetYearGoal: vi.fn(),
  fetchStreak: (...args: unknown[]) => fetchStreak(...args),
  fetchAchievements: (...args: unknown[]) => fetchAchievements(...args),
  fetchYearInReview: (...args: unknown[]) => fetchYearInReview(...args)
}));

const goal = (overrides: Partial<ReadingGoal> = {}): ReadingGoal => ({
  year: 2026,
  configured: true,
  items: { target: 40, done: 12, expected: 20, percent: 30, behind: 8, onTrack: false, projected: 24 },
  daysLeft: 146,
  daysPassed: 219,
  completed: false,
  ...overrides
});

const streak: Streak = {
  currentStreak: 3,
  longestStreak: 11,
  lastReadOn: '2026-08-07',
  readToday: true,
  recentDays: ['2026-08-07']
};

const review: YearInReview = {
  year: 2026,
  finishedCount: 12,
  pageCount: 3400,
  minuteCount: 900,
  readingDays: 60,
  longestStreak: 11,
  averageRating: 8.2,
  monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: index === 2 ? 4 : 1 })),
  topRated: [],
  topAuthors: [],
  topTypes: []
};

describe('GoalsPage', () => {
  beforeEach(() => {
    [fetchGoal, fetchStreak, fetchAchievements, fetchYearInReview].forEach((mock) => mock.mockReset());
    fetchGoal.mockResolvedValue(goal());
    fetchStreak.mockResolvedValue(streak);
    fetchAchievements.mockResolvedValue([
      { code: 'FIRST_ITEM', title: 'Начало положено', description: 'Первое завершённое', unlocked: true, unlockedOn: '2026-01-05' },
      { code: 'TEN_ITEMS', title: 'Десяток', description: 'Десять завершённых', unlocked: false }
    ]);
    fetchYearInReview.mockResolvedValue(review);
  });

  /**
   * Главное на странице — ответ «успею или нет»: проценты его не дают, а неделя даёт.
   * «Нужно в неделю» считается от остатка и оставшихся дней, «темп» — от пройденных.
   */
  it('открывается выводом и четырьмя числами, а не формой', async () => {
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText(/Отстаёте на 8 книг/)).toBeInTheDocument();
    expect(screen.getByText('Осталось')).toBeInTheDocument();
    expect(screen.getByText('28 книг')).toBeInTheDocument();
    expect(screen.getByText('1,3')).toBeInTheDocument();
    expect(screen.getByText('0,4')).toBeInTheDocument();
    expect(screen.getByText('24 книги')).toBeInTheDocument();

    // Форма спрятана под карандаш: страница начинается с результата, а не с настройки.
    expect(screen.queryByLabelText('Произведений')).not.toBeInTheDocument();
  });

  it('открывает форму цели карандашом', async () => {
    renderWithStore(<GoalsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить цель' }));

    expect(await screen.findByLabelText('Произведений')).toHaveValue('40');
  });

  /** Цели по страницам и минутам остаются, но идут второй строкой, а не спорят с главной. */
  it('показывает цели по страницам второй строкой', async () => {
    fetchGoal.mockResolvedValue(
      goal({ pages: { target: 15000, done: 11240, expected: 11000, percent: 74, behind: 0, onTrack: true, projected: 15200 } })
    );
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText('Страницы')).toBeInTheDocument();
    expect(screen.getByText('11 240 из 15 000 страниц')).toBeInTheDocument();
    expect(screen.getByText('идёте по плану')).toBeInTheDocument();
  });

  /** Незаведённая цель не считается вовсе — страница предлагает её поставить. */
  it('предлагает поставить цель, если её нет', async () => {
    fetchGoal.mockResolvedValue(goal({ configured: false, items: undefined }));
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText(/Цель ещё не поставлена/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Поставить цель' }));
    expect(await screen.findByLabelText('Произведений')).toBeInTheDocument();
  });

  it('показывает закрытые достижения вместе с полученными', async () => {
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText('Начало положено')).toBeInTheDocument();
    expect(screen.getByText(/получено 05 янв/)).toBeInTheDocument();
    // У неполученного вместо даты стоит условие: иначе непонятно, что осталось сделать.
    expect(screen.getByText('Десять завершённых')).toBeInTheDocument();
  });

  /** Итоги года на первом экране — одна строка: разворачивать таблицу каждый раз незачем. */
  it('раскрывает итоги года по кнопке', async () => {
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText(/12 книг, 3 400 страниц, 60 дней с чтением/)).toBeInTheDocument();
    expect(screen.queryByText('Лучшее за год')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Смотреть итоги' }));

    expect(await screen.findByText('Лучшее за год')).toBeInTheDocument();
  });
});
