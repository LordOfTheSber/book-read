import { LibraryItem } from '@/shared/types/library';
import { addSession } from '../api/progressApi';

/**
 * Быстрый шаг «+N»: заход от текущей позиции, без открытия формы.
 *
 * Живёт в сущности, а не в каждом виджете: «+N» есть в строке списка, на полке «Продолжить»,
 * в блоке состояния записи и на вкладке «Прогресс» — четыре места, где обрезка по объёму
 * должна работать одинаково. Сервер и так обрежет позицию, но тогда в истории останется
 * заход за краем шкалы.
 *
 * Возвращает `false`, если двигаться уже некуда: вызывающая сторона сама решает, сказать ли
 * об этом человеку.
 */
export const advanceProgress = async (item: LibraryItem, delta: number): Promise<boolean> => {
  const current = item.progress?.current ?? 0;
  const target = item.progress?.total ? Math.min(current + delta, item.progress.total) : current + delta;
  if (target === current) {
    return false;
  }
  await addSession(item.id, { fromPosition: current, toPosition: target });
  return true;
};
