import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Form,
  Grid,
  Input,
  InputNumber,
  List,
  Progress,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import { RightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { loadNodes } from '@/entities/node';
import { fetchMonitoringMetrics, updateMonitoringMetricsEnabled, updateMonitoringSettings } from '@/entities/monitoring/api/monitoringApi';
import { EndpointMetrics, MonitoringMetrics, NodeMetricsSnapshot, SlowRequest, SystemNode } from '@/shared/types/library';
import { isSuperAdmin } from '@/shared/lib/roles';
import { useNodesPageStyles } from './NodesPage.styles';

const formatBytes = (value?: number) => {
  if (value === undefined || value === null) return '—';
  if (value === 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / 1024 ** exponent;
  return `${num.toFixed(num >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const formatPercent = (used?: number, total?: number) => {
  if (used === undefined || total === undefined || total <= 0) return undefined;
  const percent = Math.max(0, Math.min(100, (used / total) * 100));
  return Number(percent.toFixed(2));
};

const formatDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

const formatMs = (value?: number) => {
  if (value === undefined || value === null) return '—';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} с`;
  }
  return `${Math.round(value)} мс`;
};

const calculateUsed = (total?: number, free?: number) =>
  total !== undefined && free !== undefined ? total - free : undefined;

const heartbeatStatus = (lastReportedAt?: string) => {
  if (!lastReportedAt) return { status: 'default' as const, text: 'нет данных' };
  const diff = Date.now() - new Date(lastReportedAt).getTime();
  if (diff > 60_000) return { status: 'error' as const, text: 'нет сигнала' };
  if (diff > 20_000) return { status: 'warning' as const, text: 'задержка' };
  return { status: 'success' as const, text: 'в сети' };
};

export const NodesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, loading, error, lastUpdated } = useAppSelector((state) => state.nodes);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useNodesPageStyles();
  const [settingsForm] = Form.useForm();
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsUpdating, setMetricsUpdating] = useState(false);
  const [settingsUpdating, setSettingsUpdating] = useState(false);
  const user = useAppSelector((state) => state.auth.user);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchMonitoringMetrics();
      setMetrics(data);
      setMetricsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить метрики';
      setMetricsError(message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    dispatch(loadNodes());
    const intervalId = window.setInterval(() => dispatch(loadNodes()), 10000);
    return () => window.clearInterval(intervalId);
  }, [dispatch]);

  useEffect(() => {
    loadMetrics();
    const intervalId = window.setInterval(loadMetrics, 10000);
    return () => window.clearInterval(intervalId);
  }, [loadMetrics]);

  useEffect(() => {
    if (metrics?.settings) {
      settingsForm.setFieldsValue({
        pingIntervalSeconds: metrics.settings.pingIntervalSeconds,
        pingPath: metrics.settings.pingPath
      });
    }
  }, [metrics, settingsForm]);

  const handleToggleMetrics = async (enabled: boolean) => {
    setMetricsUpdating(true);
    try {
      await updateMonitoringMetricsEnabled(enabled);
      await loadMetrics();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить настройки метрик';
      setMetricsError(message);
    } finally {
      setMetricsUpdating(false);
    }
  };

  const handleUpdateSettings = async (values?: { pingIntervalSeconds: number; pingPath: string }) => {
    try {
      const payload = values ?? (await settingsForm.validateFields());
      setSettingsUpdating(true);
      await updateMonitoringSettings(payload);
      await loadMetrics();
    } catch (err) {
      if (err instanceof Error) {
        setMetricsError(err.message);
      }
    } finally {
      setSettingsUpdating(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    navigate(`/nodes/${nodeId}`);
  };

  const columns: ColumnsType<SystemNode> = [
    {
      title: 'Узел',
      dataIndex: 'nodeKey',
      ellipsis: true,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Link strong onClick={() => handleNodeClick(record.id)}>
            {value}
          </Typography.Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.hostname || '—'}
            {record.port ? `:${record.port}` : ''}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      responsive: ['sm'],
      render: (ip: string | undefined) => ip || '—'
    },
    {
      title: 'CPU',
      dataIndex: 'cpuLoad',
      render: (value: number | undefined) => {
        if (value === undefined || value === null || value < 0) return '—';
        const percent = Number((value * 100).toFixed(2));
        return <Tag color={value > 0.85 ? 'red' : value > 0.65 ? 'orange' : 'green'}>{percent}%</Tag>;
      }
    },
    {
      title: 'Память',
      render: (_, record) => {
        const used = calculateUsed(record.systemMemoryTotal, record.systemMemoryFree);
        const percent = formatPercent(used, record.systemMemoryTotal);
        return percent !== undefined ? (
          <Space direction="vertical" size={2}>
            <Progress
              percent={Math.round(percent)}
              size="small"
              status={percent > 90 ? 'exception' : percent > 75 ? 'active' : 'normal'}
            />
            <Typography.Text type="secondary">
              {formatBytes(used)} / {formatBytes(record.systemMemoryTotal)}
            </Typography.Text>
          </Space>
        ) : (
          '—'
        );
      }
    },
    {
      title: 'Heap',
      render: (_, record) => {
        const used = record.heapUsed;
        const percent = formatPercent(used, record.heapMax);
        return percent !== undefined ? (
          <Space direction="vertical" size={2}>
            <Progress
              percent={Math.round(percent)}
              size="small"
              status={percent > 90 ? 'exception' : percent > 75 ? 'active' : 'normal'}
            />
            <Typography.Text type="secondary">
              {formatBytes(used)} / {formatBytes(record.heapMax)}
            </Typography.Text>
          </Space>
        ) : (
          '—'
        );
      }
    },
    {
      title: 'Диски',
      render: (_, record) => {
        const used = calculateUsed(record.diskTotal, record.diskFree);
        const percent = formatPercent(used, record.diskTotal);
        return percent !== undefined ? (
          <Space direction="vertical" size={2}>
            <Progress
              percent={Math.round(percent)}
              size="small"
              status={percent > 90 ? 'exception' : percent > 75 ? 'active' : 'normal'}
            />
            <Typography.Text type="secondary">
              {formatBytes(used)} / {formatBytes(record.diskTotal)}
            </Typography.Text>
          </Space>
        ) : (
          '—'
        );
      }
    },
    {
      title: 'Обновлен',
      dataIndex: 'uptimeSeconds',
      render: (value: number | undefined) => formatDuration(value)
    },
    {
      title: 'Пульс',
      dataIndex: 'lastReportedAt',
      render: (value: string | undefined) => {
        const status = heartbeatStatus(value);
        return (
          <Tooltip title={value ? new Date(value).toLocaleString() : 'Нет данных'}>
            <Badge status={status.status} text={status.text} />
          </Tooltip>
        );
      }
    },
    {
      title: '',
      width: 40,
      render: (_, record) => (
        <Tooltip title="Подробнее">
          <Typography.Link onClick={() => handleNodeClick(record.id)}>
            <RightOutlined />
          </Typography.Link>
        </Tooltip>
      )
    }
  ];

  const endpointColumns: ColumnsType<EndpointMetrics> = useMemo(
    () => [
      {
        title: 'Метод',
        dataIndex: 'method',
        width: 90
      },
      {
        title: 'Путь',
        dataIndex: 'path',
        ellipsis: true
      },
      {
        title: 'Запросы',
        dataIndex: 'totalRequests',
        width: 110
      },
      {
        title: 'Ошибки',
        dataIndex: 'errorRequests',
        width: 90,
        render: (value: number) => (
          <Tag color={value > 0 ? 'red' : 'green'}>{value}</Tag>
        )
      },
      {
        title: 'Среднее',
        dataIndex: 'averageDurationMs',
        width: 120,
        render: (value: number) => formatMs(value)
      },
      {
        title: 'Макс',
        dataIndex: 'maxDurationMs',
        width: 110,
        render: (value: number) => formatMs(value)
      }
    ],
    []
  );

  const slowRequestColumns: ColumnsType<SlowRequest> = useMemo(
    () => [
      {
        title: 'Когда',
        dataIndex: 'occurredAt',
        width: 160,
        render: (value: string) => new Date(value).toLocaleTimeString()
      },
      {
        title: 'Метод',
        dataIndex: 'method',
        width: 90
      },
      {
        title: 'Путь',
        dataIndex: 'path',
        ellipsis: true
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 90
      },
      {
        title: 'Длительность',
        dataIndex: 'durationMs',
        width: 120,
        render: (value: number) => formatMs(value)
      }
    ],
    []
  );

  const renderNodeMetrics = (node: NodeMetricsSnapshot) => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text type="secondary">
        Снимок: {node.capturedAt ? new Date(node.capturedAt).toLocaleString() : '—'}
      </Typography.Text>
      <Card size="small" title="Глобальные показатели">
        <Space direction="vertical" size={4}>
          <Typography.Text>Всего запросов: {node.global?.totalRequests ?? 0}</Typography.Text>
          <Typography.Text>Ошибок (5xx): {node.global?.errorRequests ?? 0}</Typography.Text>
          <Typography.Text>Средняя длительность: {formatMs(node.global?.averageDurationMs)}</Typography.Text>
          <Typography.Text>Максимальная длительность: {formatMs(node.global?.maxDurationMs)}</Typography.Text>
          <Typography.Text type="secondary">
            Последний запрос:{' '}
            {node.global?.lastRequestAt ? new Date(node.global.lastRequestAt).toLocaleString() : '—'}
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="Метрики по эндпоинтам">
        <Table<EndpointMetrics>
          dataSource={node.endpoints ?? []}
          columns={endpointColumns}
          rowKey={(row) => `${row.method}-${row.path}`}
          pagination={false}
          size="small"
          scroll={{ x: true }}
          locale={{ emptyText: 'Нет данных по запросам' }}
        />
      </Card>

      <Card size="small" title="Медленные запросы">
        <Table<SlowRequest>
          dataSource={node.slowRequests ?? []}
          columns={slowRequestColumns}
          rowKey={(row) => `${row.method}-${row.path}-${row.occurredAt}-${row.durationMs}`}
          pagination={false}
          size="small"
          scroll={{ x: true }}
          locale={{ emptyText: 'Медленные запросы не зафиксированы' }}
        />
      </Card>
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title="Метрики сервиса"
        style={styles.card}
        headStyle={styles.cardHead}
        bodyStyle={styles.cardBody}
        extra={
          <Space>
            <Typography.Text type="secondary">Сбор метрик</Typography.Text>
            <Switch
              checked={metrics?.enabled ?? false}
              loading={metricsUpdating}
              onChange={handleToggleMetrics}
            />
          </Space>
        }
      >
        {metricsError && (
          <Alert message={metricsError} type="error" showIcon style={{ marginBottom: 12 }} />
        )}

        {!metrics?.enabled && (
          <Alert
            message="Сбор метрик выключен"
            description="Включите сбор, чтобы видеть показатели задержек и ошибок. Пинг также выключается вместе со сбором."
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        {metricsLoading && !metrics ? (
          <Typography.Text type="secondary">Загрузка метрик...</Typography.Text>
        ) : (
          <>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Обновлено: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleTimeString() : '—'}
            </Typography.Text>

            {isSuperAdmin(user?.role) && (
              <Card size="small" title="Автоматический пинг" style={{ marginBottom: 12 }}>
                <Form
                  form={settingsForm}
                  layout="inline"
                  onFinish={handleUpdateSettings}
                  disabled={!metrics?.enabled}
                >
                  <Form.Item
                    label="Интервал (сек)"
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
                    <Input placeholder="/api/v1/monitoring/ping" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={settingsUpdating}>
                      Сохранить
                    </Button>
                  </Form.Item>
                </Form>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Пинг создаёт регулярные запросы для контроля задержек и доступности узла.
                </Typography.Text>
              </Card>
            )}

            {metrics?.nodes?.length ? (
              <Collapse
                accordion
                items={metrics.nodes.map((node) => ({
                  key: node.nodeKey,
                  label: node.nodeKey,
                  children: renderNodeMetrics(node)
                }))}
              />
            ) : (
              <Typography.Text type="secondary">Нет данных по узлам.</Typography.Text>
            )}
          </>
        )}
      </Card>

      <Card
        title="Мониторинг узлов"
        style={styles.card}
        headStyle={styles.cardHead}
        bodyStyle={styles.cardBody}
        extra={
          <Typography.Text type="secondary">
            Обновлено: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </Typography.Text>
        }
      >
        {error && (
          <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
            {error}
          </Typography.Paragraph>
        )}

        {isMobile ? (
          <List
            dataSource={list}
            loading={loading}
            style={styles.mobileList}
            renderItem={(node) => {
              const hb = heartbeatStatus(node.lastReportedAt);
              return (
                <div
                  style={{ ...styles.mobileCard, cursor: 'pointer' }}
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                >
                  <div style={styles.mobileHeader}>
                    <div style={styles.mobileMeta}>
                      <Typography.Link strong ellipsis>
                        {node.nodeKey}
                      </Typography.Link>
                      <Typography.Text type="secondary">
                        {node.hostname || '—'}
                        {node.port ? `:${node.port}` : ''}
                      </Typography.Text>
                      <Typography.Text type="secondary">IP: {node.ip || '—'}</Typography.Text>
                      <Badge status={hb.status} text={hb.text} />
                    </div>
                    <Tag
                      color={
                        node.cpuLoad && node.cpuLoad > 0.85
                          ? 'red'
                          : node.cpuLoad && node.cpuLoad > 0.65
                            ? 'orange'
                            : 'green'
                      }
                    >
                      CPU: {node.cpuLoad !== undefined ? `${Number((node.cpuLoad * 100).toFixed(2))}%` : '—'}
                    </Tag>
                  </div>

                  <Space direction="vertical" size={6} style={{ marginTop: 8, width: '100%' }}>
                    <Space direction="vertical" size={2}>
                      <Typography.Text type="secondary">Память</Typography.Text>
                      <Progress
                        percent={
                          formatPercent(
                            calculateUsed(node.systemMemoryTotal, node.systemMemoryFree),
                            node.systemMemoryTotal
                          ) ?? 0
                        }
                        size="small"
                        status="active"
                      />
                      <Typography.Text type="secondary">
                        {formatBytes(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree))} /{' '}
                        {formatBytes(node.systemMemoryTotal)}
                      </Typography.Text>
                    </Space>

                    <Space direction="vertical" size={2}>
                      <Typography.Text type="secondary">Heap</Typography.Text>
                      <Progress
                        percent={formatPercent(node.heapUsed, node.heapMax) ?? 0}
                        size="small"
                        status="normal"
                      />
                      <Typography.Text type="secondary">
                        {formatBytes(node.heapUsed)} / {formatBytes(node.heapMax)}
                      </Typography.Text>
                    </Space>

                    <Space direction="vertical" size={2}>
                      <Typography.Text type="secondary">Диски</Typography.Text>
                      <Progress
                        percent={
                          formatPercent(calculateUsed(node.diskTotal, node.diskFree), node.diskTotal) ?? 0
                        }
                        size="small"
                        status="normal"
                      />
                      <Typography.Text type="secondary">
                        {formatBytes(calculateUsed(node.diskTotal, node.diskFree))} /{' '}
                        {formatBytes(node.diskTotal)}
                      </Typography.Text>
                    </Space>

                    <Typography.Text type="secondary">
                      Аптайм: {formatDuration(node.uptimeSeconds)}
                    </Typography.Text>
                  </Space>
                </div>
              );
            }}
          />
        ) : (
          <div style={styles.tableWrapper}>
            <Table<SystemNode>
              rowKey={(row) => row.id}
              dataSource={list}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: true }}
              columns={columns}
            />
          </div>
        )}
      </Card>
    </Space>
  );
};
