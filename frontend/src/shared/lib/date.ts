/**
 * Дата в том же виде, в каком её присылает сервер. Через `toISOString` нельзя: он переводит
 * в UTC, и у всех западнее Гринвича календарные сетки съезжали бы на день относительно
 * серверных дат.
 */
export const toLocalIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const parseServerDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  return new Date(hasTimezone ? trimmed : `${trimmed}Z`);
};

const EMPTY = '—';

const format = (value: string | null | undefined, options: Intl.DateTimeFormatOptions) => {
  const date = parseServerDate(value);
  if (!date || Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat('ru-RU', options).format(date);
};

/** 10 янв. 2026 г. */
export const formatDate = (value?: string | null) =>
  format(value, { day: '2-digit', month: 'short', year: 'numeric' });

/** 10.01.2026, 12:30 */
export const formatDateTime = (value?: string | null) =>
  format(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 12:30:45 */
export const formatTime = (value?: string | null) =>
  format(value, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * «сегодня», «вчера», «3 дня назад», «2 недели назад».
 *
 * В списке выписок и событий точная дата не нужна: важно, свежая запись или прошлогодняя,
 * а «10 янв. 2026 г.» это приходится вычислять в уме.
 */
export const formatRelativeDate = (value?: string | null) => {
  const date = parseServerDate(value);
  if (!date || Number.isNaN(date.getTime())) return EMPTY;

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';

  const relative = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });
  if (days < 7) return relative.format(-days, 'day');
  if (days < 31) return relative.format(-Math.round(days / 7), 'week');
  if (days < 365) return relative.format(-Math.round(days / 30), 'month');
  return relative.format(-Math.round(days / 365), 'year');
};
