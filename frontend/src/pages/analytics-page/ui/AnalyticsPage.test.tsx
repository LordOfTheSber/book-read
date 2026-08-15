import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';
import { renderWithStore } from '@/test/renderWithStore';
import { BookAnalytics, ReadingAnalytics } from '@/shared/types/library';

const fetchBookAnalytics = vi.fn();
const fetchReadingAnalytics = vi.fn();

vi.mock('@/entities/analytics/api/analyticsApi', () => ({
  fetchBookAnalytics: (...args: unknown[]) => fetchBookAnalytics(...args),
  fetchReadingAnalytics: (...args: unknown[]) => fetchReadingAnalytics(...args)
}));

const books: BookAnalytics = {
  totalItems: 42,
  favoriteItems: 5,
  averageRating: 8.1,
  statusBreakdown: { READING: 3, ON_HOLD: 1, COMPLETED: 30, PLANNED: 7, DROPPED: 1 },
  topTypes: [{ typeId: 't1', typeName: 'Роман', count: 20 }],
  topSources: [{ sourceId: 's1', sourceName: 'Бумага', count: 25 }]
};

const reading = (overrides: Partial<ReadingAnalytics> = {}): ReadingAnalytics => ({
  byMonth: [
    { period: '2026-07', finished: 1, pages: 300, minutes: 120 },
    { period: '2026-08', finished: 4, pages: 1200, minutes: 480 }
  ],
  byYear: [
    { period: '2025', finished: 10, pages: 3000, minutes: 1200 },
    { period: '2026', finished: 15, pages: 4500, minutes: 1500 }
  ],
  heatmap: [{ date: '2026-08-07', minutes: 45, sessions: 2 }],
  pace: { pagesPerDay: 60, minutesPerDay: 30, pagesPerHour: 120, activeDays: 10, windowDays: 90 },
  forecasts: [
    { itemId: 'i1', title: 'Дюна', remaining: 100, unit: 'PAGES', expectedFinish: '2026-08-30' },
    { itemId: 'i2', title: 'Гиперион', remaining: 50, unit: 'PAGES' }
  ],
  byAuthor: [{ authorId: 'a1', authorName: 'Фрэнк Герберт', count: 6 }],
  byLanguage: [{ label: 'русский', count: 30 }],
  byDecade: [{ label: '1980-е', count: 8 }],
  purchases: {
    purchased: 12,
    finishedOfPurchased: 7,
    unreadPurchased: 4,
    spentByCurrency: { RUB: 3400, EUR: 25.5 }
  },
  currentYear: { period: '2026', finished: 15, pages: 4500, minutes: 1500 },
  previousYear: { period: '2025', finished: 10, pages: 3600, minutes: 1500 },
  ...overrides
});

const card = (title: string) => screen.getByText(title).closest('.ant-card') as HTMLElement;

describe('AnalyticsPage', () => {
  beforeEach(() => {
    fetchBookAnalytics.mockReset();
    fetchReadingAnalytics.mockReset();
    fetchBookAnalytics.mockResolvedValue(books);
    fetchReadingAnalytics.mockResolvedValue(reading());
  });

  /** Динамика — второй запрос, и без него страница показывала бы только срез «сегодня». */
  it('запрашивает оба среза аналитики', async () => {
    renderWithStore(<AnalyticsPage />);

    expect(await screen.findByText('Динамика чтения')).toBeInTheDocument();
    expect(fetchBookAnalytics).toHaveBeenCalledTimes(1);
    expect(fetchReadingAnalytics).toHaveBeenCalledTimes(1);
  });

  it('показывает темп и оговорку, по каким дням он посчитан', async () => {
    renderWithStore(<AnalyticsPage />);

    const pace = card('Темп и прогноз');
    expect(await within(pace).findByText('60')).toBeInTheDocument();
    expect(within(pace).getByText('120')).toBeInTheDocument();
    expect(
      within(pace).getByText(/Считается по 10 дням с чтением, а не по всем дням окна/)
    ).toBeInTheDocument();
  });

  /** Без темпа сервер не присылает дату, и подставлять её на клиенте тем более нельзя. */
  it('вместо даты без прогноза пишет, что темпа нет', async () => {
    renderWithStore(<AnalyticsPage />);

    const forecasts = card('Темп и прогноз');
    expect(await within(forecasts).findByText('Дюна')).toBeInTheDocument();
    expect(within(forecasts).getByText('Гиперион')).toBeInTheDocument();
    expect(within(forecasts).getByText('темпа пока нет')).toBeInTheDocument();
  });

  it('разносит потраченное по валютам', async () => {
    renderWithStore(<AnalyticsPage />);

    const purchases = card('Куплено и прочитано');
    expect(await within(purchases).findByText('3 400 RUB')).toBeInTheDocument();
    expect(within(purchases).getByText('25,5 EUR')).toBeInTheDocument();
    expect(within(purchases).getByText('58% покупок')).toBeInTheDocument();
  });

  /** Сравниваются сопоставимые отрезки, и подпись должна об этом говорить, а не молчать. */
  it('сравнивает год с тем же отрезком прошлого года', async () => {
    renderWithStore(<AnalyticsPage />);

    const dynamics = card('Динамика чтения');
    expect(
      await within(dynamics).findByText(/2026 против 2025 за тот же\s+отрезок года/)
    ).toBeInTheDocument();
    expect(within(dynamics).getByText('+50%')).toBeInTheDocument();
    expect(within(dynamics).getByText('+25%')).toBeInTheDocument();
    // Ровно столько же, сколько год назад, — это «+0%», а не пустая подпись.
    expect(within(dynamics).getByText('+0%')).toBeInTheDocument();
  });

  /** Год назад в этот момент могло не быть ничего — тогда процент не считается вовсе. */
  it('без прошлогодних данных не показывает процент', async () => {
    fetchReadingAnalytics.mockResolvedValue(
      reading({ previousYear: { period: '2025', finished: 0, pages: 0, minutes: 0 } })
    );
    renderWithStore(<AnalyticsPage />);

    const dynamics = card('Динамика чтения');
    expect(await within(dynamics).findByText('15')).toBeInTheDocument();
    expect(within(dynamics).queryByText(/%$/)).not.toBeInTheDocument();
  });

  /**
   * Пять разбивок подряд и были главной причиной перегруженности: теперь это одна карточка
   * с переключателем, и пустые справочники в него не попадают.
   */
  it('складывает разбивки в один переключатель и прячет пустые', async () => {
    const user = userEvent.setup();
    renderWithStore(<AnalyticsPage />);

    const breakdown = card('Что в библиотеке');
    expect(await within(breakdown).findByText('Фрэнк Герберт')).toBeInTheDocument();
    expect(within(breakdown).getByRole('radio', { name: 'Языки' })).toBeInTheDocument();
    expect(within(breakdown).queryByRole('radio', { name: 'Источники' })).toBeInTheDocument();

    // У Segmented кликабельна подпись: сам input перекрыт и не принимает указатель.
    await user.click(within(breakdown).getByText('Десятилетия'));
    expect(await within(breakdown).findByText('1980-е')).toBeInTheDocument();
  });

  it('не показывает разбивку по типам, если справочник пуст', async () => {
    fetchBookAnalytics.mockResolvedValue({ ...books, topTypes: [], topSources: [] });
    renderWithStore(<AnalyticsPage />);

    const breakdown = card('Что в библиотеке');
    expect(await within(breakdown).findByText('Фрэнк Герберт')).toBeInTheDocument();
    expect(within(breakdown).queryByRole('radio', { name: 'Типы' })).not.toBeInTheDocument();
    expect(within(breakdown).queryByRole('radio', { name: 'Источники' })).not.toBeInTheDocument();
  });

  /**
   * Проценты считаются от библиотеки, а не от лидера списка: иначе первый автор всегда «100%»,
   * и два разных числа выглядят одинаково.
   */
  it('считает доли разбивки от всей библиотеки', async () => {
    renderWithStore(<AnalyticsPage />);

    const breakdown = card('Что в библиотеке');
    // 6 записей автора из 42 в библиотеке — это 14%, а не 100%.
    expect(await within(breakdown).findByText('14%')).toBeInTheDocument();
  });

  /** Сводка и динамика грузятся раздельно: падение второй не должно уносить страницу целиком. */
  it('переживает ошибку загрузки динамики', async () => {
    fetchReadingAnalytics.mockRejectedValue(new Error('нет связи'));
    renderWithStore(<AnalyticsPage />);

    expect(await screen.findByText('Не удалось загрузить динамику чтения')).toBeInTheDocument();
    // Сводка приходит отдельным запросом и остаётся на месте.
    expect(screen.getByText('Всего книг')).toBeInTheDocument();
  });
});
