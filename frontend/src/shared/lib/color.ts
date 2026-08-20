/** Разбор `#rrggbb` в тройку каналов. Другие формы цвета в бренде не используются. */
const channels = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
};

const toHex = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');

/**
 * Смешение двух цветов: `t` — доля второго.
 *
 * Нужна, чтобы девять цветов видов произведения давали и светлую заливку чипа, и читаемый текст
 * на тёмном фоне, оставаясь одним значением в реестре, а не тремя вручную подобранными.
 */
export const mix = (from: string, to: string, t: number): string => {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((channel, index) => toHex(channel + (b[index] - channel) * t)).join('')}`;
};

/** Тот же цвет с прозрачностью: для заливок поверх незнакомого фона. */
export const alpha = (hex: string, value: number): string => {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
};

/**
 * Тёмный ли фон. Ant Design не сообщает выбранный алгоритм темы через токены, а компонентам
 * shared нужен ответ без обращения к провайдеру приложения: считаем яркость самого фона.
 */
export const isDarkSurface = (color: string): boolean => {
  if (!color.startsWith('#')) return false;
  const [r, g, b] = channels(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};
