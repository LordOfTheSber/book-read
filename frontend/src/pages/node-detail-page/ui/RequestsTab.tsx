import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Card, Empty, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, ApiOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { EndpointMetrics, NodeMetricsSnapshot, SlowRequest } from '@/shared/types/library';
import { fetchMonitoringMetrics } from '@/entities/monitoring/api/monitoringApi';
import { getErrorMessage } from '@/shared/lib/errors';
import { formatMs, formatNumber } from '@/shared/lib/format';
import { formatDateTime, formatTime } from '@/shared/lib/date';
import { StatTile } from '@/shared/ui/StatTile';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

const POLL_INTERVAL_MS = 10_000;

interface Props {
  nodeKey?: string;
}

/**
 * Запросы узла: сводка, разбивка по эндпоинтам и медленные вызовы. Настройки проверки
 * доступности отсюда уехали — они общие для всех узлов и живут своей карточкой.
 */
export const RequestsTab: React.FC<Props> = ({ nodeKey }) => {
  const styles = useNodeDetailPageStyles();

  const [metrics, setMetrics] = useState<NodeMetricsSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMonitoringMetrics();
      setEnabled(data.enabled);
      setMetrics(data.nodes?.find((snapshot) => snapshot.nodeKey === nodeKey) ?? null);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось загрузить метрики'));
    } finally {
      setLoading(false);
    }
  }, [nodeKey]);

  useEffect(() => {
    if (!nodeKey) return;
    load();
    const intervalId = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [nodeKey, load]);

  const endpointColumns: ColumnsType<EndpointMetrics> = useMemo(
    () => [
      { title: 'Метод', dataIndex: 'method', width: 90 },
      { title: 'Путь', dataIndex: 'path', ellipsis: true },
      {
        title: 'Запросы',
        dataIndex: 'totalRequests',
        width: 110,
        align: 'right',
        render: (value: number) => <span style={styles.tabularNumbers}>{formatNumber(value)}</span>
      },
      {
        title: 'Ошибки',
        dataIndex: 'errorRequests',
        width: 100,
        align: 'right',
        render: (value: number) => (
          <Typography.Text type={value > 0 ? 'danger' : 'secondary'} style={styles.tabularNumbers}>
            {formatNumber(value)}
          </Typography.Text>
        )
      },
      {
        title: 'Среднее',
        dataIndex: 'averageDurationMs',
        width: 110,
        align: 'right',
        render: (value: number) => <span style={styles.tabularNumbers}>{formatMs(value)}</span>
      },
      {
        title: 'Максимум',
        dataIndex: 'maxDurationMs',
        width: 110,
        align: 'right',
        responsive: ['lg'],
        render: (value: number) => <span style={styles.tabularNumbers}>{formatMs(value)}</span>
      }
    ],
    [styles]
  );

  const slowColumns: ColumnsType<SlowRequest> = useMemo(
    () => [
      {
        title: 'Когда',
        dataIndex: 'occurredAt',
        width: 110,
        render: (value: string) => (
          <Typography.Text type="secondary" style={styles.tabularNumbers}>
            {formatTime(value)}
          </Typography.Text>
        )
      },
      { title: 'Метод', dataIndex: 'method', width: 90 },
      { title: 'Путь', dataIndex: 'path', ellipsis: true },
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 90,
        align: 'right',
        render: (value: number) => (
          <Typography.Text type={value >= 500 ? 'danger' : value >= 400 ? 'warning' : undefined}>
            {value}
          </Typography.Text>
        )
      },
      {
        title: 'Длительность',
        dataIndex: 'durationMs',
        width: 130,
        align: 'right',
        render: (value: number) => <span style={styles.tabularNumbers}>{formatMs(value)}</span>
      }
    ],
    [styles]
  );

  const global = metrics?.global;
  const errorRate =
    global?.totalRequests && global.totalRequests > 0
      ? (global.errorRequests / global.totalRequests) * 100
      : 0;

  return (
    <>
      {error && <Alert type="error" showIcon message={error} style={styles.alert} />}

      {!enabled && (
        <Alert
          type="warning"
          showIcon
          style={styles.alert}
          message="Метрики не собираются"
          description="Пока сбор выключен, задержки и ошибки не записываются. Переключатель — в карточке «Проверка доступности»."
        />
      )}

      {loading && !metrics ? (
        <Card style={styles.card} styles={{ body: styles.cardBody }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : metrics ? (
        <>
          <div style={styles.stats}>
            <StatTile label="Запросов" value={formatNumber(global?.totalRequests ?? 0)} icon={<ApiOutlined />} />
            <StatTile
              label="Ошибок 5xx"
              value={formatNumber(global?.errorRequests ?? 0)}
              hint={global?.totalRequests ? `${errorRate.toFixed(1)}% запросов` : undefined}
              icon={<WarningOutlined />}
              accent={global?.errorRequests ? styles.accents.error : undefined}
            />
            <StatTile label="Среднее время" value={formatMs(global?.averageDurationMs)} icon={<ClockCircleOutlined />} />
            <StatTile label="Максимум" value={formatMs(global?.maxDurationMs)} icon={<AlertOutlined />} />
          </div>

          <Typography.Text type="secondary" style={styles.hint}>
            Снимок метрик: {formatDateTime(metrics.capturedAt)}
            {global?.lastRequestAt ? ` · последний запрос ${formatDateTime(global.lastRequestAt)}` : ''}
          </Typography.Text>

          <Typography.Title level={5} style={styles.sectionTitle}>
            По эндпоинтам
          </Typography.Title>
          <Table<EndpointMetrics>
            dataSource={metrics.endpoints ?? []}
            columns={endpointColumns}
            rowKey={(row) => `${row.method}-${row.path}`}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            style={styles.table}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Запросов пока не было" /> }}
          />

          <Typography.Title level={5} style={styles.sectionTitle}>
            Медленные запросы
          </Typography.Title>
          <Table<SlowRequest>
            dataSource={metrics.slowRequests ?? []}
            columns={slowColumns}
            rowKey={(row) => `${row.method}-${row.path}-${row.occurredAt}-${row.durationMs}`}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            style={styles.table}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Медленных запросов не зафиксировано" />
            }}
          />
        </>
      ) : (
        <Card style={styles.card} styles={{ body: styles.cardBody }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text strong>Метрик по этому узлу нет</Typography.Text>
                <Typography.Text type="secondary">
                  Узел ещё не прислал снимок — данные появятся после первых запросов.
                </Typography.Text>
              </Space>
            }
          />
        </Card>
      )}
    </>
  );
};
