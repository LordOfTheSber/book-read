import React, { useEffect } from 'react';
import { Badge, Card, Grid, List, Progress, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { loadNodes } from '@/entities/node';
import { SystemNode } from '@/shared/types/library';
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
  const { list, loading, error, lastUpdated } = useAppSelector((state) => state.nodes);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useNodesPageStyles();

  useEffect(() => {
    dispatch(loadNodes());
    const intervalId = window.setInterval(() => dispatch(loadNodes()), 10000);
    return () => window.clearInterval(intervalId);
  }, [dispatch]);

  const columns: ColumnsType<SystemNode> = [
    {
      title: 'Узел',
      dataIndex: 'nodeKey',
      ellipsis: true,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
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
    }
  ];

  return (
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
              <div style={styles.mobileCard} key={node.id}>
                <div style={styles.mobileHeader}>
                  <div style={styles.mobileMeta}>
                    <Typography.Text strong ellipsis>
                      {node.nodeKey}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {node.hostname || '—'}
                      {node.port ? `:${node.port}` : ''}
                    </Typography.Text>
                    <Typography.Text type="secondary">IP: {node.ip || '—'}</Typography.Text>
                    <Badge status={hb.status} text={hb.text} />
                  </div>
                  <Tag color={node.cpuLoad && node.cpuLoad > 0.85 ? 'red' : node.cpuLoad && node.cpuLoad > 0.65 ? 'orange' : 'green'}>
                    CPU: {node.cpuLoad !== undefined ? `${Number((node.cpuLoad * 100).toFixed(2))}%` : '—'}
                  </Tag>
                </div>

                <Space direction="vertical" size={6} style={{ marginTop: 8, width: '100%' }}>
                  <Space direction="vertical" size={2}>
                    <Typography.Text type="secondary">Память</Typography.Text>
                    <Progress
                      percent={formatPercent(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree), node.systemMemoryTotal) ?? 0}
                      size="small"
                      status="active"
                    />
                    <Typography.Text type="secondary">
                      {formatBytes(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree))} / {formatBytes(node.systemMemoryTotal)}
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
                      percent={formatPercent(calculateUsed(node.diskTotal, node.diskFree), node.diskTotal) ?? 0}
                      size="small"
                      status="normal"
                    />
                    <Typography.Text type="secondary">
                      {formatBytes(calculateUsed(node.diskTotal, node.diskFree))} / {formatBytes(node.diskTotal)}
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
  );
};
