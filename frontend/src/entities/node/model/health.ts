import { parseServerDate } from '@/shared/lib/date';
import { calculateUsed, formatPercent } from '@/shared/lib/format';
import type { SystemNode } from '@/shared/types/library';

export type HeartbeatState = 'online' | 'delayed' | 'offline' | 'unknown';

export interface Heartbeat {
  state: HeartbeatState;
  /** Пресет Badge/Tag: один и тот же цвет на обзоре и на странице узла. */
  status: 'success' | 'warning' | 'error' | 'default';
  text: string;
}

/**
 * Состояние узла по времени последнего сигнала. Пульс приходит раз в десять секунд, поэтому
 * минута молчания — это уже отказ, а двадцать секунд — задержка, о которой стоит сказать, но
 * не стоит поднимать тревогу.
 */
export const nodeHeartbeat = (lastReportedAt?: string): Heartbeat => {
  const parsed = parseServerDate(lastReportedAt);
  if (!parsed) return { state: 'unknown', status: 'default', text: 'нет данных' };

  const diff = Date.now() - parsed.getTime();
  if (diff > 60_000) return { state: 'offline', status: 'error', text: 'нет сигнала' };
  if (diff > 20_000) return { state: 'delayed', status: 'warning', text: 'задержка' };
  return { state: 'online', status: 'success', text: 'в сети' };
};

/** Отрицательная загрузка означает «метрика недоступна», а не нулевой процессор. */
export const nodeCpuPercent = (node?: Partial<SystemNode>) =>
  node?.cpuLoad === undefined || node?.cpuLoad === null || node.cpuLoad < 0
    ? undefined
    : Number((node.cpuLoad * 100).toFixed(1));

export const nodeMemoryPercent = (node?: Partial<SystemNode>) =>
  formatPercent(calculateUsed(node?.systemMemoryTotal, node?.systemMemoryFree), node?.systemMemoryTotal);

export const nodeDiskPercent = (node?: Partial<SystemNode>) =>
  formatPercent(calculateUsed(node?.diskTotal, node?.diskFree), node?.diskTotal);

export const nodeHeapPercent = (node?: Partial<SystemNode>) =>
  formatPercent(node?.heapUsed, node?.heapMax);
