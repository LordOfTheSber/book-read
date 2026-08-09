import React from 'react';
import { screen } from '@testing-library/react';
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

  /** Главное на странице — не проценты, а отставание: без графика «12 из 40» ни о чём не говорит. */
  it('показывает отставание от равномерного темпа', async () => {
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText('Отставание')).toBeInTheDocument();
    expect(screen.getByText('8 шт.')).toBeInTheDocument();
    expect(screen.getByText('20 шт.')).toBeInTheDocument();
    expect(screen.getByText('24 шт. за год')).toBeInTheDocument();
  });

  it('показывает опережение вместо цифры отставания', async () => {
    fetchGoal.mockResolvedValue(
      goal({ items: { target: 40, done: 30, expected: 20, percent: 75, behind: 0, onTrack: true, projected: 60 } })
    );
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText('Опережение')).toBeInTheDocument();
    expect(screen.getByText('идёте по плану')).toBeInTheDocument();
  });

  /** Незаведённая цель не считается вовсе — страница предлагает её поставить. */
  it('предлагает поставить цель, если её нет', async () => {
    fetchGoal.mockResolvedValue(goal({ configured: false, items: undefined }));
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText(/Цель ещё не поставлена/)).toBeInTheDocument();
  });

  it('показывает закрытые достижения вместе с полученными', async () => {
    renderWithStore(<GoalsPage />);

    expect(await screen.findByText('Начало положено')).toBeInTheDocument();
    expect(screen.getByText('Десяток')).toBeInTheDocument();
    expect(screen.getByText('ещё не получено')).toBeInTheDocument();
  });
});
