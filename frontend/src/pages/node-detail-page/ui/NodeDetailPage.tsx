import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Space,
  Spin,
  Switch,
  Table,
  Tooltip,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { EndpointMetrics, NodeMetricsSnapshot, ProcessInfo, SlowRequest } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  clearCurrentNode,
  downloadNodeLogs,
  loadNodeById,
  loadNodeMemoryDetail
} from '@/entities/node';
import { fetchMonitoringMetrics, updateMonitoringMetricsEnabled, updateMonitoringSettings } from '@/entities/monitoring/api/monitoringApi';
import { isAdminLike, isSuperAdmin } from '@/shared/lib/roles';
import { parseServerDate } from '@/shared/lib/date';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

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

const heartbeatStatus = (lastReportedAt?: string) => {
  const parsed = parseServerDate(lastReportedAt);
  if (!parsed) return { status: 'default' as const, text: 'нет данных' };
  const diff = Date.now() - parsed.getTime();
  if (diff > 60_000) return { status: 'error' as const, text: 'нет сигнала' };
  if (diff > 20_000) return { status: 'warning' as const, text: 'задержка' };
  return { status: 'success' as const, text: 'в сети' };
};

export const NodeDetailPage: React.FC = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const styles = useNodeDetailPageStyles();
  const [settingsForm] = Form.useForm();

  const { currentNode, currentNodeLoading, memoryDetail, memoryDetailLoading, error } =
    useAppSelector((state) => state.nodes);
  const user = useAppSelector((state) => state.auth.user);

  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const [metrics, setMetrics] = useState<NodeMetricsSnapshot | null>(null);
  const [metricsEnabled, setMetricsEnabled] = useState<boolean>(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsUpdating, setMetricsUpdating] = useState(false);
  const [settingsUpdating, setSettingsUpdating] = useState(false);

  const loadData = useCallback(() => {
    if (nodeId) {
      dispatch(loadNodeById(nodeId));
      dispatch(loadNodeMemoryDetail(nodeId));
    }
  }, [dispatch, nodeId]);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchMonitoringMetrics();
      setMetricsEnabled(data.enabled);
      const nodeSnapshot =
        data.nodes?.find((snapshot) => snapshot.nodeKey === currentNode?.nodeKey) ?? null;
      setMetrics(nodeSnapshot);
      setMetricsError(null);
      if (data.settings) {
        settingsForm.setFieldsValue({
          pingIntervalSeconds: data.settings.pingIntervalSeconds,
          pingPath: data.settings.pingPath
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить метрики';
      setMetricsError(message);
    } finally {
      setMetricsLoading(false);
    }
  }, [currentNode?.nodeKey, settingsForm]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 10000);
    return () => {
      window.clearInterval(intervalId);
      dispatch(clearCurrentNode());
    };
  }, [dispatch, loadData]);

  useEffect(() => {
    if (!currentNode?.nodeKey) return;
    loadMetrics();
    const intervalId = window.setInterval(loadMetrics, 10000);
    return () => window.clearInterval(intervalId);
  }, [currentNode?.nodeKey, loadMetrics]);

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

  const handleUpdateSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      setSettingsUpdating(true);
      await updateMonitoringSettings(values);
      await loadMetrics();
    } catch (err) {
      if (err instanceof Error) {
        setMetricsError(err.message);
      }
    } finally {
      setSettingsUpdating(false);
    }
  };

  const handleDownloadLogs = async () => {
    if (!nodeId) return;
    setDownloadingLogs(true);
    try {
      await downloadNodeLogs(nodeId);
    } catch (e) {
      console.error('Failed to download logs:', e);
    } finally {
      setDownloadingLogs(false);
    }
  };

  const handleBack = () => {
    navigate('/nodes');
  };

  if (currentNodeLoading && !currentNode) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !currentNode) {
    return (
      <div style={styles.container}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={styles.backButton}>
          Назад к узлам
        </Button>
        <Alert type="error" message="Ошибка загрузки" description={error} showIcon />
      </div>
    );
  }

  const node = currentNode;
  const hb = heartbeatStatus(node?.lastReportedAt);
  const lastReportedAt = parseServerDate(node?.lastReportedAt);

  const systemMemoryUsed =
    node?.systemMemoryTotal !== undefined && node?.systemMemoryFree !== undefined
      ? node.systemMemoryTotal - node.systemMemoryFree
      : undefined;

  const diskUsed =
    node?.diskTotal !== undefined && node?.diskFree !== undefined
      ? node.diskTotal - node.diskFree
      : undefined;

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
          <Typography.Text type={value > 0 ? 'danger' : undefined}>{value}</Typography.Text>
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
        render: (value: string) => {
          const parsed = parseServerDate(value);
          return parsed ? parsed.toLocaleTimeString() : '—';
        }
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

  return (
    <div style={styles.container}>
      <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={styles.backButton}>
        Назад к узлам
      </Button>

      <Card
        title={
          <div style={styles.headerRow}>
            <Space>
              <Typography.Text strong style={{ fontSize: 18 }}>
                {node?.nodeKey || 'Узел'}
              </Typography.Text>
              <Badge status={hb.status} text={hb.text} />
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={currentNodeLoading}>
                Обновить
              </Button>
              {isSuperAdmin(user?.role) && (
                <Tooltip title="Скачать логи сервера">
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadLogs}
                    loading={downloadingLogs}
                  >
                    Скачать логи
                  </Button>
                </Tooltip>
              )}
            </Space>
          </div>
        }
        style={styles.card}
        headStyle={styles.cardHead}
        bodyStyle={styles.cardBody}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="Хост">{node?.hostname || '—'}</Descriptions.Item>
          <Descriptions.Item label="IP">{node?.ip || '—'}</Descriptions.Item>
          <Descriptions.Item label="Порт">{node?.port || '—'}</Descriptions.Item>
          <Descriptions.Item label="Аптайм">{formatDuration(node?.uptimeSeconds)}</Descriptions.Item>
          <Descriptions.Item label="CPU">
            {node?.cpuLoad !== undefined
              ? `${Number((node.cpuLoad * 100).toFixed(2))}%`
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Последний отчёт">
            {lastReportedAt ? lastReportedAt.toLocaleString() : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="Метрики запросов"
        style={styles.card}
        headStyle={styles.cardHead}
        bodyStyle={styles.cardBody}
        extra={
          <Space>
            <Typography.Text type="secondary">Сбор метрик</Typography.Text>
            <Switch
              checked={metricsEnabled}
              loading={metricsUpdating}
              onChange={handleToggleMetrics}
              disabled={!isAdminLike(user?.role)}
            />
          </Space>
        }
      >
        {metricsError && (
          <Alert message={metricsError} type="error" showIcon style={{ marginBottom: 12 }} />
        )}

        {!metricsEnabled && (
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
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {isSuperAdmin(user?.role) && (
              <Card size="small" title="Автоматический пинг" style={{ marginBottom: 12 }}>
                <Form
                  form={settingsForm}
                  layout="inline"
                  onFinish={handleUpdateSettings}
                  disabled={!metricsEnabled}
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
              </Card>
            )}

            {metrics ? (
              <>
                <Typography.Text type="secondary">
                  Снимок: {parseServerDate(metrics.capturedAt)?.toLocaleString() ?? '—'}
                </Typography.Text>

                <Card size="small" title="Глобальные показатели">
                  <Space direction="vertical" size={4}>
                    <Typography.Text>Всего запросов: {metrics.global?.totalRequests ?? 0}</Typography.Text>
                    <Typography.Text>Ошибок (5xx): {metrics.global?.errorRequests ?? 0}</Typography.Text>
                    <Typography.Text>
                      Средняя длительность: {formatMs(metrics.global?.averageDurationMs)}
                    </Typography.Text>
                    <Typography.Text>
                      Максимальная длительность: {formatMs(metrics.global?.maxDurationMs)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Последний запрос:{' '}
                      {metrics.global?.lastRequestAt
                        ? parseServerDate(metrics.global.lastRequestAt)?.toLocaleString() ?? '—'
                        : '—'}
                    </Typography.Text>
                  </Space>
                </Card>

                <Card size="small" title="Метрики по эндпоинтам">
                  <Table<EndpointMetrics>
                    dataSource={metrics.endpoints ?? []}
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
                    dataSource={metrics.slowRequests ?? []}
                    columns={slowRequestColumns}
                    rowKey={(row) => `${row.method}-${row.path}-${row.occurredAt}-${row.durationMs}`}
                    pagination={false}
                    size="small"
                    scroll={{ x: true }}
                    locale={{ emptyText: 'Медленные запросы не зафиксированы' }}
                  />
                </Card>
              </>
            ) : (
              <Typography.Text type="secondary">Нет данных по метрикам для узла.</Typography.Text>
            )}
          </Space>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Системная память"
            style={styles.card}
            headStyle={styles.cardHead}
            bodyStyle={styles.cardBody}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Progress
                percent={formatPercent(systemMemoryUsed, node?.systemMemoryTotal) ?? 0}
                status={
                  (formatPercent(systemMemoryUsed, node?.systemMemoryTotal) ?? 0) > 90
                    ? 'exception'
                    : 'active'
                }
              />
              <Typography.Text>
                Использовано: {formatBytes(systemMemoryUsed)} / {formatBytes(node?.systemMemoryTotal)}
              </Typography.Text>
              <Typography.Text type="secondary">
                Свободно: {formatBytes(node?.systemMemoryFree)}
              </Typography.Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Heap (JVM/Node)"
            style={styles.card}
            headStyle={styles.cardHead}
            bodyStyle={styles.cardBody}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Progress
                percent={formatPercent(node?.heapUsed, node?.heapMax) ?? 0}
                status={
                  (formatPercent(node?.heapUsed, node?.heapMax) ?? 0) > 90 ? 'exception' : 'active'
                }
              />
              <Typography.Text>
                Использовано: {formatBytes(node?.heapUsed)} / {formatBytes(node?.heapMax)}
              </Typography.Text>
              <Typography.Text type="secondary">
                Committed: {formatBytes(node?.heapCommitted)}
              </Typography.Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Дисковое пространство"
            style={styles.card}
            headStyle={styles.cardHead}
            bodyStyle={styles.cardBody}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Progress
                percent={formatPercent(diskUsed, node?.diskTotal) ?? 0}
                status={
                  (formatPercent(diskUsed, node?.diskTotal) ?? 0) > 90 ? 'exception' : 'active'
                }
              />
              <Typography.Text>
                Использовано: {formatBytes(diskUsed)} / {formatBytes(node?.diskTotal)}
              </Typography.Text>
              <Typography.Text type="secondary">
                Свободно: {formatBytes(node?.diskFree)}
              </Typography.Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Расход памяти Node.js"
            style={styles.card}
            headStyle={styles.cardHead}
            bodyStyle={styles.cardBody}
            loading={memoryDetailLoading && !memoryDetail}
          >
            {memoryDetail?.memoryUsage ? (
              <div style={styles.memoryCard}>
                <div style={styles.memoryItem}>
                  <Typography.Text style={styles.memoryLabel}>
                    RSS (Resident Set Size)
                  </Typography.Text>
                  <Typography.Text style={styles.memoryValue}>
                    {formatBytes(memoryDetail.memoryUsage.rss)}
                  </Typography.Text>
                </div>
                <div style={styles.memoryItem}>
                  <Typography.Text style={styles.memoryLabel}>Heap Total</Typography.Text>
                  <Typography.Text style={styles.memoryValue}>
                    {formatBytes(memoryDetail.memoryUsage.heapTotal)}
                  </Typography.Text>
                </div>
                <div style={styles.memoryItem}>
                  <Typography.Text style={styles.memoryLabel}>Heap Used</Typography.Text>
                  <Typography.Text style={styles.memoryValue}>
                    {formatBytes(memoryDetail.memoryUsage.heapUsed)}
                  </Typography.Text>
                </div>
                <div style={styles.memoryItem}>
                  <Typography.Text style={styles.memoryLabel}>External</Typography.Text>
                  <Typography.Text style={styles.memoryValue}>
                    {formatBytes(memoryDetail.memoryUsage.external)}
                  </Typography.Text>
                </div>
                <div style={styles.memoryItemLast}>
                  <Typography.Text style={styles.memoryLabel}>Array Buffers</Typography.Text>
                  <Typography.Text style={styles.memoryValue}>
                    {formatBytes(memoryDetail.memoryUsage.arrayBuffers)}
                  </Typography.Text>
                </div>
              </div>
            ) : (
              <Typography.Text type="secondary">Нет данных о памяти Node.js</Typography.Text>
            )}

            {memoryDetail?.v8HeapStatistics && (
              <div style={styles.v8Section}>
                <Typography.Title level={5}>V8 Heap Statistics</Typography.Title>
                <div style={styles.memoryCard}>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Total Heap Size</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.totalHeapSize)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Used Heap Size</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.usedHeapSize)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Heap Size Limit</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.heapSizeLimit)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Total Available</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.totalAvailableSize)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Total Physical</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.totalPhysicalSize)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItem}>
                    <Typography.Text style={styles.memoryLabel}>Malloced Memory</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.mallocedMemory)}
                    </Typography.Text>
                  </div>
                  <div style={styles.memoryItemLast}>
                    <Typography.Text style={styles.memoryLabel}>Peak Malloced</Typography.Text>
                    <Typography.Text style={styles.memoryValue}>
                      {formatBytes(memoryDetail.v8HeapStatistics.peakMallocedMemory)}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Топ-10 процессов по потреблению памяти"
        style={styles.card}
        headStyle={styles.cardHead}
        bodyStyle={styles.cardBody}
        loading={memoryDetailLoading && !memoryDetail}
      >
        {memoryDetail?.topProcessesByMemory && memoryDetail.topProcessesByMemory.length > 0 ? (
          <Table<ProcessInfo>
            dataSource={memoryDetail.topProcessesByMemory}
            rowKey={(record) => `${record.pid}-${record.command}`}
            pagination={false}
            size="small"
            scroll={{ x: true }}
            columns={processColumns}
          />
        ) : (
          <Typography.Text type="secondary">
            Нет данных о процессах. Информация о процессах доступна только на сервере, где запущено приложение.
          </Typography.Text>
        )}
      </Card>
    </div>
  );
};

const formatBytesKb = (kb?: number) => {
  if (kb === undefined || kb === null) return '—';
  if (kb === 0) return '0 КБ';
  const bytes = kb * 1024;
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const num = bytes / 1024 ** exponent;
  return `${num.toFixed(num >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const processColumns: ColumnsType<ProcessInfo> = [
  {
    title: 'PID',
    dataIndex: 'pid',
    width: 80
  },
  {
    title: 'Пользователь',
    dataIndex: 'user',
    width: 120,
    ellipsis: true
  },
  {
    title: 'CPU %',
    dataIndex: 'cpuPercent',
    width: 80,
    render: (value: number) => (value !== null && value !== undefined ? `${value.toFixed(1)}%` : '—')
  },
  {
    title: 'MEM %',
    dataIndex: 'memoryPercent',
    width: 80,
    render: (value: number | null) => (value !== null && value !== undefined ? `${value.toFixed(1)}%` : '—')
  },
  {
    title: 'RSS',
    dataIndex: 'residentMemoryKb',
    width: 100,
    render: (value: number) => formatBytesKb(value)
  },
  {
    title: 'VSZ',
    dataIndex: 'virtualMemoryKb',
    width: 100,
    render: (value: number) => formatBytesKb(value)
  },
  {
    title: 'Команда',
    dataIndex: 'command',
    ellipsis: true
  }
];
