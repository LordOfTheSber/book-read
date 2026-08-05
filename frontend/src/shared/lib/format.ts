const DASH = '—';

/** 5.2 ГБ — единица подбирается по величине. */
export const formatBytes = (value?: number | null) => {
  if (value === undefined || value === null) return DASH;
  if (value === 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / 1024 ** exponent;
  return `${num.toFixed(num >= 10 ? 0 : 1)} ${units[exponent]}`;
};

/** Доля used от total в процентах; undefined, если данных нет. */
export const formatPercent = (used?: number | null, total?: number | null) => {
  if (used === undefined || used === null || !total || total <= 0) return undefined;
  const percent = Math.max(0, Math.min(100, (used / total) * 100));
  return Number(percent.toFixed(2));
};

/** 3д 4ч / 4ч 12м / 12м */
export const formatDuration = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null) return DASH;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

/** 184 320 — с неразрывными разделителями разрядов. */
export const formatNumber = (value?: number | null) =>
  value === undefined || value === null ? DASH : new Intl.NumberFormat('ru-RU').format(value);

/** 320 мс / 1.25 с */
export const formatMs = (value?: number | null) => {
  if (value === undefined || value === null) return DASH;
  return value >= 1000 ? `${(value / 1000).toFixed(2)} с` : `${Math.round(value)} мс`;
};

/** Оценка без лишнего нуля: 7 остаётся семёркой, 7.5 — семёркой с половиной. */
export const formatScore = (value?: number | null) => {
  if (value === undefined || value === null) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export const calculateUsed = (total?: number | null, free?: number | null) =>
  total !== undefined && total !== null && free !== undefined && free !== null ? total - free : undefined;

export type UsageLevel = 'normal' | 'warning' | 'critical';

/** Общий порог для CPU, памяти, heap и дисков — чтобы цвета значили одно и то же. */
export const usageLevel = (percent?: number): UsageLevel => {
  if (percent === undefined) return 'normal';
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  return 'normal';
};
