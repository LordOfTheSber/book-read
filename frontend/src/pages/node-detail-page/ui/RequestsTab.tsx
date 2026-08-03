import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Skeleton, Space, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, ApiOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { EndpointMetrics, NodeMetricsSnapshot, SlowRequest } from '@/shared/types/library';
import {
  fetchMonitoringMetrics,
  updateMonitoringMetricsEnabled,
  updateMonitoringSettings
} from '@/entities/monitoring/api/monitoringApi';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { UserRole } from '@/shared/types/library';
import { getErrorMessage, isFormValidationError } from '@/shared/lib/errors';
import { formatMs, formatNumber } from '@/shared/lib/format';
import { formatDateTime, formatTime } from '@/shared/lib/date';
import { StatTile } from '@/shared/ui/StatTile';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

const POLL_INTERVAL_MS = 10_000;

interface Props {
  nodeKey?: string;
  role?: UserRole;
}

interface PingSettingsValues {
  pingIntervalSeconds: number;
  pingPath: string;
}

export const RequestsTab: React.FC<Props> = ({ nodeKey, role }) => {
  const styles = useNodeDetailPageStyles();
  const [form] = Form.useForm<PingSettingsValues>();
  const canToggle = isAdminLike(role);
  const canEditPing = isSuperAdmin(role);

  const [metrics, setMetrics] = useState<NodeMetricsSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMonitoringMetrics();
      setEnabled(data.enabled);
      setMetrics(data.nodes?.find((snapshot) => snapshot.nodeKey === nodeKey) ?? null);
      setError(null);
      if (data.settings && isSuperAdmin(role)) {
        form.setFieldsValue({
          pingIntervalSeconds: data.settings.pingIntervalSeconds,
          pingPath: data.settings.pingPath
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось загрузить метрики'));
    } finally {
      setLoading(false);
    }
  }, [nodeKey, form, role]);

  useEffect(() => {
    if (!nodeKey) return;
    load();
    const intervalId = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [nodeKey, load]);

  const handleToggle = async (value: boolean) => {
    setToggling(true);
    try {
      await updateMonitoringMetricsEnabled(value);
      setError(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось переключить сбор метрик'));
    } finally {
      setToggling(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const values = await form.validateFields();
      await updateMonitoringSettings(values);
      setError(null);
      await load();
    } catch (err) {
      // Ошибки валидации формы рисует сама форма — на уровень страницы не выносим.
      if (!isFormValidationError(err)) {
        setError(getErrorMessage(err, 'Не удалось сохранить настройки пинга'));
      }
    } finally {
      setSavingSettings(false);
    }
  };

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
      <Card
        style={{ ...styles.card, marginBottom: 16 }}
        styles={{ body: styles.cardBody }}
        title="Сбор метрик"
        extra={
          <Space>
            <Typography.Text type="secondary">{enabled ? 'включен' : 'выключен'}</Typography.Text>
            <Switch checked={enabled} loading={toggling} onChange={handleToggle} disabled={!canToggle} />
          </Space>
        }
      >
        {error && <Alert type="error" showIcon message={error} style={styles.alert} />}

        {!enabled && (
          <Alert
            type="warning"
            showIcon
            style={styles.alert}
            message="Метрики не собираются"
            description="Пока сбор выключен, задержки и ошибки не записываются. Автоматический пинг тоже остановлен."
          />
        )}

        {canEditPing && (
          <Form form={form} layout="inline" disabled={!enabled} style={{ rowGap: 12 }}>
            <Form.Item
              label="Интервал пинга, сек"
              name="pingIntervalSeconds"
              rules={[{ required: true, message: 'Укажите интервал' }]}
            >
              <InputNumber min={5} max={3600} />
            </Form.Item>
            <Form.Item
              label="Путь"
              name="pingPath"
              rules={[{ required: true, message: 'Укажите путь' }]}
            >
              <Input placeholder="/api/v1/monitoring/ping" style={{ minWidth: 240 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveSettings} loading={savingSettings}>
                Сохранить
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>

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
