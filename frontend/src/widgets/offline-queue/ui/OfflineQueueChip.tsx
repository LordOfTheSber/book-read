import React from 'react';
import { Tooltip, theme } from 'antd';
import { CloudSyncOutlined, DisconnectOutlined } from '@ant-design/icons';
import { plural, pluralize } from '@/shared/lib/plural';
import { useOfflineQueue } from '../model/useOfflineQueue';

/**
 * Очередь отложенных правок — чипом в шапке.
 *
 * Раньше это была полоса во всю ширину: она сдвигала страницу вниз при каждом обрыве связи,
 * хотя говорит ровно одно число. Чип виден так же, а места не занимает.
 */
interface Props {
  /**
   * Узкий вариант: только значок и число. На телефоне полная подпись съедала строку
   * с именем раздела, а сказать она может ровно то же самое — через подсказку.
   */
  compact?: boolean;
}

export const OfflineQueueChip: React.FC<Props> = ({ compact }) => {
  const { online, queued, retry } = useOfflineQueue();
  const { token } = theme.useToken();

  if (online && queued === 0) {
    return null;
  }

  const pending = queued > 0 ? pluralize(queued, ['правка', 'правки', 'правок']) : null;

  // Согласование по числу: «1 правка не ушла», но «2 правки не ушли».
  const label = online
    ? `${pending} ${plural(queued, ['не ушла', 'не ушли', 'не ушли'])}`
    : pending
      ? `${pending} ${plural(queued, ['ждёт', 'ждут', 'ждут'])} сети`
      : 'Нет сети';

  const hint = online
    ? 'Сервер не принял изменения. Повторим автоматически — или нажмите, чтобы отправить сейчас.'
    : pending
      ? 'Нет сети. Изменения сохраняются локально и уйдут, когда связь вернётся.'
      : 'Нет сети. Показаны последние загруженные данные.';

  return (
    <Tooltip title={hint}>
      <button
        type="button"
        className="app-shell-reset"
        onClick={() => void retry()}
        aria-label={`${label}. ${hint}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 28,
          padding: compact ? '0 8px' : '0 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          background: token.colorWarningBg,
          color: token.colorWarningText,
          border: `1px solid ${token.colorWarningBorder}`
        }}
      >
        {online ? <CloudSyncOutlined /> : <DisconnectOutlined />}
        {compact ? queued > 0 && queued : label}
      </button>
    </Tooltip>
  );
};
