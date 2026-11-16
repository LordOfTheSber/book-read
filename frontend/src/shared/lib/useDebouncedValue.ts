import { useEffect, useState } from 'react';

/**
 * Возвращает значение, обновляющееся не чаще, чем раз в `delay` мс после
 * последнего изменения. Нужен, чтобы поиск не дёргал API на каждый символ.
 */
export const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
