import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';
import { createTestStore, renderWithStore } from '@/test/renderWithStore';
import { BookAnalytics, PeriodStats, ReadingAnalytics } from '@/shared/types/library';

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
  statusBreakdown: { READING: 3, ON_HOLD: 1, COMPLETED: 30, PLANNED: 7, DROPPED: 4 },
  topTypes: [{ typeId: 't1', typeName: 'Роман', count: 20 }],
  topSources: [{ sourceId: 's1', sourceName: 'Бумага', count: 25 }]
};

/**
 * Окно помесячной динамики целиком — 24 месяца, как их отдаёт сервер: без них не проверить ни
 * полугодие, ни сравнение годов, а именно на них держатся отрезки отчёта.
 */
const monthsWindow = (): PeriodStats[] =>
  Array.from({ length: 24 }, (_, index) => {
    const month = new Date(2024, 8 + index, 1);
    const year = month.getFullYear();
    return {
      period: `${year}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      finished: year === 2026 ? 2 : 1,
      pages: 100,
      minutes: 60
    };
  });

const reading = (overrides: Partial<ReadingAnalytics> = {}): ReadingAnalytics => ({
  byMonth: monthsWindow(),
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

/** Вывод собран из полужирных чисел и обычного текста, поэтому сверяется целиком по узлу. */
const summary = () => screen.getByTestId('analytics-summary');

const summaryCard = () => summary().closest('.ant-card') as HTMLElement;

/** Отчёт собран из двух запросов: до их ответа на странице нет ни вывода, ни разрезов. */
const ready = () => screen.findByTestId('analytics-summary');

const period = async (label: string) => {
  const user = userEvent.setup();
  // У Segmented кликабельна подпись: сам input перекрыт и не принимает указатель.
  await user.click(screen.getByText(label));
};

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

  /** Отчёт начинается с вывода фразой, а не с восьми одинаковых плиток. */
  it('открывается выводом за год', async () => {
    renderWithStore(<AnalyticsPage />);

    expect(await screen.findByTestId('analytics-summary')).toHaveTextContent(
      'За 2026 год дочитано 15 книг — на 50% больше, чем за тот же отрезок прошлого года.'
    );
    expect(summary()).toHaveTextContent('средняя оценка по библиотеке — 8,1');
  });

  it('под фразой считает прирост по каждой мере', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    const numbers = summaryCard();
    // 15 против 10 книг, 4 500 против 3 600 страниц и ровно столько же минут, сколько год назад.
    expect(within(numbers).getByText('+50%')).toBeInTheDocument();
    expect(within(numbers).getByText('+25%')).toBeInTheDocument();
    expect(within(numbers).getByText('+0%')).toBeInTheDocument();
  });

  /**
   * Оценка и брошенное не делятся по годам: они стоят в том же ряду, но с подписью, чтобы их
   * не читали как итог периода.
   */
  it('всебиблиотечные числа помечает подписью', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    const numbers = summaryCard();
    expect(within(numbers).getByText('по библиотеке')).toBeInTheDocument();
    expect(within(numbers).getByText('за всё время')).toBeInTheDocument();
    // Брошенное берётся из сводки по библиотеке, а не из отрезка: 4 записи из 42.
    expect(within(numbers).getByText('4')).toBeInTheDocument();
  });

  /** Год назад в этот момент могло не быть ничего — тогда процент не считается вовсе. */
  it('без прошлогодних данных не показывает процент', async () => {
    fetchReadingAnalytics.mockResolvedValue(
      reading({ previousYear: { period: '2025', finished: 0, pages: 0, minutes: 0 } })
    );
    renderWithStore(<AnalyticsPage />);

    expect(await screen.findByTestId('analytics-summary')).toHaveTextContent('За 2026 год дочитано 15 книг.');
    expect(within(summaryCard()).queryByText(/%/)).not.toBeInTheDocument();
  });

  /** Полугодие сравнивается с теми же шестью месяцами, а не с прошлым годом целиком. */
  it('на полугодии берёт те же месяцы год назад', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    await period('Полгода');

    expect(summary()).toHaveTextContent(
      'За последние полгода дочитано 12 книг — на 100% больше, чем за те же месяцы год назад.'
    );
  });

  it('на всём времени складывает годы и никого ни с кем не сравнивает', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    await period('Всё время');

    expect(summary()).toHaveTextContent('За всё время дочитано 25 книг.');
    // Шкала становится годовой: столбцы подписаны годами, а не месяцами.
    expect(within(card('Динамика чтения')).getByText('2025')).toBeInTheDocument();
  });

  /** Сравнение годов — единственный режим с двумя сериями, и легенда появляется вместе с ними. */
  it('сравнение годов подписывает обе серии', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();
    const dynamics = card('Динамика чтения');
    expect(within(dynamics).queryByText('2025')).not.toBeInTheDocument();

    await period('Сравнить годы');

    // Прошлый год есть только в легенде: столбцы подписаны месяцами нынешнего.
    expect(within(dynamics).getByText('2025')).toBeInTheDocument();
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

  /** Вывод карточки темпа — про год целиком: список ниже отвечает только про отдельные книги. */
  it('считает, чем закончится год при нынешнем темпе', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    expect(
      within(card('Темп и прогноз')).getByText(/2026 год закроется примерно на \d+ книгах/)
    ).toBeInTheDocument();
  });

  it('разносит потраченное по валютам', async () => {
    renderWithStore(<AnalyticsPage />);

    const purchases = card('Куплено и прочитано');
    expect(await within(purchases).findByText('3 400 RUB')).toBeInTheDocument();
    expect(within(purchases).getByText('25,5 EUR')).toBeInTheDocument();
    expect(within(purchases).getByText('7 · 58% покупок')).toBeInTheDocument();
  });

  /**
   * Разрезы стоят рядом карточками: сравнивать авторов с типами приходится взглядом, а не
   * по памяти, как было с переключателем.
   */
  it('раскладывает разрезы отдельными карточками', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    expect(within(card('Авторы')).getByText('Фрэнк Герберт')).toBeInTheDocument();
    expect(within(card('Типы')).getByText('Роман')).toBeInTheDocument();
    expect(within(card('Десятилетия')).getByText('1980-е')).toBeInTheDocument();
    expect(within(card('Языки')).getByText('русский')).toBeInTheDocument();
    expect(within(card('Источники')).getByText('Бумага')).toBeInTheDocument();
  });

  it('не показывает разрез, справочник которого пуст', async () => {
    fetchBookAnalytics.mockResolvedValue({ ...books, topTypes: [], topSources: [] });
    renderWithStore(<AnalyticsPage />);
    await ready();

    expect(within(card('Авторы')).getByText('Фрэнк Герберт')).toBeInTheDocument();
    expect(screen.queryByText('Типы')).not.toBeInTheDocument();
    expect(screen.queryByText('Источники')).not.toBeInTheDocument();
  });

  /**
   * Разрез, который делит библиотеку, считает доли от неё, а не от лидера списка: иначе первая
   * строка всегда «100%», и два разных числа выглядят одинаково.
   */
  it('считает доли разрезов от всей библиотеки', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    // 20 записей типа из 42 в библиотеке — это 48%, а не 100%.
    expect(within(card('Типы')).getByText('48%')).toBeInTheDocument();
  });

  /** У авторов такой базы нет: доля одного автора в собрании — доли процента, и полосы гаснут. */
  it('у авторов процентов не показывает вовсе', async () => {
    renderWithStore(<AnalyticsPage />);
    await ready();

    const authors = card('Авторы');
    expect(within(authors).getByText('6')).toBeInTheDocument();
    expect(within(authors).queryByText(/%/)).not.toBeInTheDocument();
  });

  /** У разреза должен быть выход к самим записям, иначе это тупик с числом. */
  it('строка разреза открывает библиотеку с наложенным фильтром', async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renderWithStore(<AnalyticsPage />, store);
    await ready();

    await user.click(within(card('Авторы')).getByRole('button', { name: /Фрэнк Герберт/ }));

    expect(store.getState().bookFilters.authorId).toBe('a1');
  });

  /** Сводка и динамика грузятся раздельно: падение второй не должно уносить страницу целиком. */
  it('переживает ошибку загрузки динамики', async () => {
    fetchReadingAnalytics.mockRejectedValue(new Error('нет связи'));
    renderWithStore(<AnalyticsPage />);

    expect(await screen.findByText('Не удалось загрузить динамику чтения')).toBeInTheDocument();
    await ready();
    // Сводка приходит отдельным запросом, и её числа остаются на месте.
    expect(within(summaryCard()).getByText('8,1')).toBeInTheDocument();
  });
});
