import type { Progress, ProgressUnit, ReadingGoal, Streak } from '@/shared/types/library';
import { plural, pluralize } from '@/shared/lib/plural';
import { formatNumber, formatScore } from '@/shared/lib/format';

/**
 * Единицы шкалы в двух падежах: «Осталось 2 страницы» и «по 24 страницы в день» согласуются
 * по-разному, а родительное «страниц» из констант годится только для числа больше пяти.
 */
const unitNominative: Record<ProgressUnit, [string, string, string]> = {
  PAGES: ['страница', 'страницы', 'страниц'],
  MINUTES: ['минута', 'минуты', 'минут'],
  EPISODES: ['эпизод', 'эпизода', 'эпизодов'],
  VOLUMES: ['том', 'тома', 'томов']
};

const unitAccusative: Record<ProgressUnit, [string, string, string]> = {
  PAGES: ['страницу', 'страницы', 'страниц'],
  MINUTES: ['минуту', 'минуты', 'минут'],
  EPISODES: ['эпизод', 'эпизода', 'эпизодов'],
  VOLUMES: ['том', 'тома', 'томов']
};

/**
 * Фразы вместо процентов.
 *
 * «53 %» — это отчёт о состоянии базы, а не ответ на вопрос человека. Вопрос всегда один:
 * успею или нет, хватит ли вечера, что будет, если пропустить сегодня. Здесь проценты
 * переводятся в то, что можно решить.
 */

/** «Осталось 188 страниц — это неделя в вашем темпе». */
export const remainingPhrase = (progress?: Progress, unit?: ProgressUnit): string | undefined => {
  if (!progress || !progress.remaining || progress.remaining <= 0) return undefined;

  const measure = plural(progress.remaining, unitNominative[unit ?? progress.unit ?? 'PAGES']);
  const left = `Осталось ${progress.remaining} ${measure}`;

  if (!progress.dailyNorm || progress.dailyNorm <= 0) {
    return left;
  }

  const days = Math.max(1, Math.ceil(progress.remaining / progress.dailyNorm));
  if (days <= 1) return `${left} — это один заход`;
  if (days <= 3) return `${left} — это ${pluralize(days, ['вечер', 'вечера', 'вечеров'])} в вашем темпе`;
  if (days <= 10) return `${left} — это неделя в вашем темпе`;
  if (days <= 45) {
    const weeks = Math.round(days / 7);
    return `${left} — это ${pluralize(weeks, ['неделя', 'недели', 'недель'])} в вашем темпе`;
  }

  const months = Math.round(days / 30);
  return `${left} — это ${pluralize(months, ['месяц', 'месяца', 'месяцев'])} в вашем темпе`;
};

/** «Чтобы успеть к сроку, читайте по 12 страниц в день». */
export const deadlinePhrase = (progress?: Progress, unit?: ProgressUnit): string | undefined => {
  if (!progress?.dailyNorm || !progress.daysLeft || progress.daysLeft <= 0) return undefined;

  const norm = Math.ceil(progress.dailyNorm);
  const measure = plural(norm, unitAccusative[unit ?? progress.unit ?? 'PAGES']);
  const days = pluralize(progress.daysLeft, ['день', 'дня', 'дней']);

  return progress.behindSchedule
    ? `Отстаёте от срока: до конца ${days}, нужно по ${norm} ${measure} в день`
    : `До срока ${days} — это по ${norm} ${measure} в день`;
};

/** «Вы на 4 книги впереди графика». */
export const goalPhrase = (goal?: ReadingGoal): string | undefined => {
  if (!goal?.configured) return undefined;

  const metric = goal.items ?? goal.pages ?? goal.minutes;
  if (!metric || metric.target <= 0) return undefined;

  const forms: [string, string, string] = goal.items
    ? ['книгу', 'книги', 'книг']
    : goal.pages
      ? ['страницу', 'страницы', 'страниц']
      : ['минуту', 'минуты', 'минут'];

  if (metric.done >= metric.target) {
    return 'Цель года выполнена — дальше идёт запас';
  }

  const gap = Math.round(Math.abs(metric.done - metric.expected));
  if (gap === 0) {
    return 'Идёте ровно по графику';
  }

  return metric.onTrack
    ? `Вы на ${gap} ${plural(gap, forms)} впереди графика`
    : `Отстаёте на ${gap} ${plural(gap, forms)} — наверстать можно за ${pluralize(
        Math.max(1, Math.ceil(gap / Math.max(1, metric.target / 52))),
        ['неделю', 'недели', 'недель']
      )}`;
};

/** «Сегодня ещё не отмечено — одна страница сохранит серию». */
export const streakPhrase = (streak?: Streak): string | undefined => {
  if (!streak) return undefined;

  if (streak.currentStreak === 0) {
    return 'Серия прервалась. Один заход сегодня начинает новую';
  }

  const days = pluralize(streak.currentStreak, ['день', 'дня', 'дней']);
  return streak.readToday
    ? `${days} подряд — сегодня уже отмечено`
    : `${days} подряд. Сегодня ещё не отмечено — одна страница сохранит серию`;
};

const BOOK_FORMS: [string, string, string] = ['книга', 'книги', 'книг'];
const PAGE_FORMS: [string, string, string] = ['страница', 'страницы', 'страниц'];
const HOUR_FORMS: [string, string, string] = ['час', 'часа', 'часов'];
const MINUTE_FORMS: [string, string, string] = ['минута', 'минуты', 'минут'];

export interface ReadingSummary {
  /** Начало фразы: «За 2026 год», «За последние полгода», «За всё время». */
  scope: string;
  finished: number;
  pages: number;
  minutes: number;
  /** Средняя оценка считается по всей библиотеке, поэтому и называется в фразе так же. */
  averageRating?: number;
  /** Прирост дочитанного к сопоставимому отрезку, в процентах; пусто — сравнивать не с чем. */
  finishedDelta?: number | null;
  /** Чем закончится сравнение: «за тот же отрезок прошлого года». */
  comparedTo?: string;
}

/**
 * Итог периода фразой: «За 2026 год дочитано 36 книг — на 22% больше, чем за тот же отрезок
 * прошлого года. Прочитано 11 240 страниц и прослушано 64 часа, средняя оценка по библиотеке — 8,4».
 *
 * Страница аналитики начинается с вывода, а не с восьми одинаковых плиток: сначала «что
 * произошло», и только потом графики, по которым это видно.
 */
export const readingSummaryPhrase = (summary: ReadingSummary): string => {
  const { scope, finished, pages, minutes, averageRating, finishedDelta, comparedTo } = summary;

  if (finished === 0 && pages === 0 && minutes === 0) {
    return `${scope} записей о чтении нет.`;
  }

  // «Дочитано 0 книг» — не фраза, а пустая ячейка таблицы: у нуля своя формулировка, и сравнивать
  // ноль с прошлым годом («на 100% меньше») тоже незачем.
  let head = finished === 0 ? `${scope} ничего не дочитано` : `${scope} дочитано ${pluralize(finished, BOOK_FORMS)}`;

  if (finished > 0 && finishedDelta != null && comparedTo) {
    head +=
      finishedDelta === 0
        ? ` — столько же, сколько ${comparedTo}`
        : ` — на ${Math.abs(finishedDelta)}% ${finishedDelta > 0 ? 'больше' : 'меньше'}, чем ${comparedTo}`;
  }

  const facts: string[] = [];
  if (pages > 0) {
    facts.push(`прочитано ${formatNumber(pages)} ${plural(pages, PAGE_FORMS)}`);
  }
  if (minutes > 0) {
    // Меньше часа в часах — это «0 часов»: короткий отрезок остаётся в минутах.
    facts.push(
      minutes >= 60
        ? `прослушано ${pluralize(Math.round(minutes / 60), HOUR_FORMS)}`
        : `прослушано ${pluralize(minutes, MINUTE_FORMS)}`
    );
  }

  let tail = facts.join(' и ');
  const score = formatScore(averageRating);
  if (score) {
    tail = tail ? `${tail}, средняя оценка по библиотеке — ${score}` : `Средняя оценка по библиотеке — ${score}`;
  }

  return tail ? `${head}. ${tail.charAt(0).toUpperCase()}${tail.slice(1)}.` : `${head}.`;
};
