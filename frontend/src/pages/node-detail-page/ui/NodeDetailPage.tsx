import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { ProcessInfo } from '@/shared/types/library';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  clearCurrentNode,
  downloadNodeLogs,
  loadNodeById,
  loadNodeMemoryDetail
} from '@/entities/node';
import { isSuperAdmin } from '@/shared/lib/roles';
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

const heartbeatStatus = (lastReportedAt?: string) => {
  if (!lastReportedAt) return { status: 'default' as const, text: 'нет данных' };
  const diff = Date.now() - new Date(lastReportedAt).getTime();
  if (diff > 60_000) return { status: 'error' as const, text: 'нет сигнала' };
  if (diff > 20_000) return { status: 'warning' as const, text: 'задержка' };
  return { status: 'success' as const, text: 'в сети' };
};

export const NodeDetailPage: React.FC = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const styles = useNodeDetailPageStyles();

  const { currentNode, currentNodeLoading, memoryDetail, memoryDetailLoading, error } =
    useAppSelector((state) => state.nodes);
  const user = useAppSelector((state) => state.auth.user);

  const [downloadingLogs, setDownloadingLogs] = useState(false);

  const loadData = useCallback(() => {
    if (nodeId) {
      dispatch(loadNodeById(nodeId));
      dispatch(loadNodeMemoryDetail(nodeId));
    }
  }, [dispatch, nodeId]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 10000);
    return () => {
      window.clearInterval(intervalId);
      dispatch(clearCurrentNode());
    };
  }, [dispatch, loadData]);

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

  const systemMemoryUsed =
    node?.systemMemoryTotal !== undefined && node?.systemMemoryFree !== undefined
      ? node.systemMemoryTotal - node.systemMemoryFree
      : undefined;

  const diskUsed =
    node?.diskTotal !== undefined && node?.diskFree !== undefined
      ? node.diskTotal - node.diskFree
      : undefined;

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
            {node?.lastReportedAt ? new Date(node.lastReportedAt).toLocaleString() : '—'}
          </Descriptions.Item>
        </Descriptions>
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
