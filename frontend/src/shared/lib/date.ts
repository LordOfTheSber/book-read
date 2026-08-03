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
