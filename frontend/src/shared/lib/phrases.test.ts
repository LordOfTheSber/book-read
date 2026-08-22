import { describe, expect, it } from 'vitest';
import { deadlinePhrase, goalPhrase, readingSummaryPhrase, remainingPhrase, streakPhrase } from './phrases';
import type { Progress, ReadingGoal, Streak } from '@/shared/types/library';

const progress = (overrides: Partial<Progress> = {}): Progress => ({
  current: 212,
  total: 400,
  unit: 'PAGES',
  percent: 53,
  remaining: 188,
  dailyNorm: 24,
  behindSchedule: false,
  ...overrides
});

const goal = (overrides: Partial<ReadingGoal> = {}): ReadingGoal => ({
  year: 2026,
  configured: true,
  daysLeft: 100,
  daysPassed: 265,
  completed: false,
  items: { target: 40, done: 26, expected: 29, percent: 65, behind: 3, onTrack: false, projected: 36 },
  ...overrides
});

describe('фразы вместо процентов', () => {
  it('переводит остаток в срок по темпу человека', () => {
    expect(remainingPhrase(progress())).toBe('Осталось 188 страниц — это неделя в вашем темпе');
  });

  /** Без темпа врать про сроки нельзя: остаётся голое число. */
  it('без нормы в день говорит только остаток', () => {
    expect(remainingPhrase(progress({ dailyNorm: undefined }))).toBe('Осталось 188 страниц');
  });

  it('у дочитанного остатка нет', () => {
    expect(remainingPhrase(progress({ remaining: 0 }))).toBeUndefined();
  });

  it('срок превращает в норму на день', () => {
    expect(deadlinePhrase(progress({ daysLeft: 8 }))).toBe('До срока 8 дней — это по 24 страницы в день');
  });

  it('отставание от срока называет отставанием', () => {
    expect(deadlinePhrase(progress({ daysLeft: 8, behindSchedule: true }))).toBe(
      'Отстаёте от срока: до конца 8 дней, нужно по 24 страницы в день'
    );
  });

  it('цель года сравнивает с графиком, а не показывает процент', () => {
    expect(goalPhrase(goal())).toContain('Отстаёте на 3 книги');
    expect(
      goalPhrase(
        goal({ items: { target: 40, done: 30, expected: 26, percent: 75, behind: 0, onTrack: true, projected: 44 } })
      )
    ).toBe('Вы на 4 книги впереди графика');
  });

  it('ненастроенная цель молчит', () => {
    expect(goalPhrase(goal({ configured: false }))).toBeUndefined();
  });

  it('серия подсказывает, что её ещё можно сохранить', () => {
    const streak = (overrides: Partial<Streak> = {}): Streak => ({
      currentStreak: 12,
      longestStreak: 118,
      readToday: false,
      recentDays: [],
      ...overrides
    });

    expect(streakPhrase(streak())).toBe(
      '12 дней подряд. Сегодня ещё не отмечено — одна страница сохранит серию'
    );
    expect(streakPhrase(streak({ readToday: true }))).toBe('12 дней подряд — сегодня уже отмечено');
    expect(streakPhrase(streak({ currentStreak: 0 }))).toBe('Серия прервалась. Один заход сегодня начинает новую');
  });
});

describe('итог аналитики фразой', () => {
  const summary = {
    scope: 'За 2026 год',
    finished: 36,
    pages: 11240,
    minutes: 3840,
    averageRating: 8.4,
    finishedDelta: 22,
    comparedTo: 'за тот же отрезок прошлого года'
  };

  it('собирает вывод из итога, сравнения и двух мер', () => {
    expect(readingSummaryPhrase(summary)).toBe(
      'За 2026 год дочитано 36 книг — на 22% больше, чем за тот же отрезок прошлого года. ' +
        'Прочитано 11\u00a0240 страниц и прослушано 64 часа, средняя оценка по библиотеке — 8,4.'
    );
  });

  it('падение называет падением, а не отрицательным приростом', () => {
    expect(readingSummaryPhrase({ ...summary, finishedDelta: -9 })).toContain('на 9% меньше');
  });

  /** Ровно столько же — это утверждение, а не «+0%» мелким шрифтом. */
  it('равенство с прошлым годом проговаривает словами', () => {
    expect(readingSummaryPhrase({ ...summary, finishedDelta: 0 })).toContain(
      'столько же, сколько за тот же отрезок прошлого года'
    );
  });

  /** Сравнивать не с чем — сравнения и нет: год назад в этот момент могло не быть ничего. */
  it('без сравнения обходится одним итогом', () => {
    expect(readingSummaryPhrase({ ...summary, finishedDelta: null })).toBe(
      'За 2026 год дочитано 36 книг. Прочитано 11\u00a0240 страниц и прослушано 64 часа, ' +
        'средняя оценка по библиотеке — 8,4.'
    );
  });

  it('меньше часа аудио остаётся минутами', () => {
    expect(readingSummaryPhrase({ ...summary, minutes: 40 })).toContain('прослушано 40 минут');
  });

  /** «Дочитано 0 книг» — пустая ячейка таблицы, а не фраза. */
  it('у нуля дочитанного своя формулировка и без процентов', () => {
    const phrase = readingSummaryPhrase({ ...summary, finished: 0, minutes: 0 });
    expect(phrase).toBe('За 2026 год ничего не дочитано. Прочитано 11\u00a0240 страниц, средняя оценка по библиотеке — 8,4.');
  });

  it('пустой период не притворяется отчётом', () => {
    expect(
      readingSummaryPhrase({ ...summary, finished: 0, pages: 0, minutes: 0 })
    ).toBe('За 2026 год записей о чтении нет.');
  });
});
