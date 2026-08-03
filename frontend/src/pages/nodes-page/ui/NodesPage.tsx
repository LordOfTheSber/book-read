import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Empty, Grid, Space, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CloudServerOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  RightOutlined,
  ThunderboltOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { loadNodes } from '@/entities/node';
import { SystemNode } from '@/shared/types/library';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { UsageMeter } from '@/shared/ui/UsageMeter';
import { formatDateTime, formatTime, parseServerDate } from '@/shared/lib/date';
import { calculateUsed, formatBytes, formatDuration, formatPercent } from '@/shared/lib/format';
import { pluralize } from '@/shared/lib/plural';
import { useNodesPageStyles } from './NodesPage.styles';

const POLL_INTERVAL_MS = 10_000;

type HeartbeatState = 'online' | 'delayed' | 'offline' | 'unknown';

const heartbeat = (lastReportedAt?: string): { state: HeartbeatState; status: 'success' | 'warning' | 'error' | 'default'; text: string } => {
  const parsed = parseServerDate(lastReportedAt);
  if (!parsed) return { state: 'unknown', status: 'default', text: 'нет данных' };
  const diff = Date.now() - parsed.getTime();
  if (diff > 60_000) return { state: 'offline', status: 'error', text: 'нет сигнала' };
  if (diff > 20_000) return { state: 'delayed', status: 'warning', text: 'задержка' };
  return { state: 'online', status: 'success', text: 'в сети' };
};

const cpuPercent = (node: SystemNode) =>
  node.cpuLoad === undefined || node.cpuLoad === null || node.cpuLoad < 0
    ? undefined
    : Number((node.cpuLoad * 100).toFixed(2));

const memoryPercent = (node: SystemNode) =>
  formatPercent(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree), node.systemMemoryTotal);

const diskPercent = (node: SystemNode) =>
  formatPercent(calculateUsed(node.diskTotal, node.diskFree), node.diskTotal);

export const NodesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { list, loading, error, lastUpdated } = useAppSelector((state) => state.nodes);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const styles = useNodesPageStyles();
  // Список опрашивается каждые 10 секунд; спиннер показываем только на ручное
  // обновление, иначе кнопка мигала бы сама по себе.
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(loadNodes());
    const intervalId = window.setInterval(() => dispatch(loadNodes()), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(loadNodes());
    } finally {
      setRefreshing(false);
    }
  };

  const openNode = (nodeId: string) => navigate(`/nodes/${nodeId}`);

  const stats = useMemo(() => {
    const states = list.map((node) => heartbeat(node.lastReportedAt).state);
    const cpuValues = list.map(cpuPercent).filter((value): value is number => value !== undefined);

    return {
      total: list.length,
      online: states.filter((state) => state === 'online').length,
      offline: states.filter((state) => state === 'offline' || state === 'unknown').length,
      avgCpu: cpuValues.length
        ? Math.round(cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length)
        : undefined
    };
  }, [list]);

  const renderHeartbeat = (node: SystemNode) => {
    const hb = heartbeat(node.lastReportedAt);
    return (
      <Tooltip title={node.lastReportedAt ? `Последний сигнал: ${formatDateTime(node.lastReportedAt)}` : 'Сигналов не было'}>
        <Badge status={hb.status} text={hb.text} />
      </Tooltip>
    );
  };

  const columns: ColumnsType<SystemNode> = [
    {
      title: 'Узел',
      dataIndex: 'nodeKey',
      render: (nodeKey: string, node) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{nodeKey}</Typography.Text>
          <Typography.Text type="secondary" style={styles.hint}>
            {node.hostname || '—'}
            {node.port ? `:${node.port}` : ''}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 150,
      responsive: ['lg'],
      render: (ip?: string) => (
        <Typography.Text type="secondary" style={styles.tabularNumbers}>
          {ip || '—'}
        </Typography.Text>
      )
    },
    {
      title: 'Пульс',
      dataIndex: 'lastReportedAt',
      width: 140,
      render: (_: unknown, node) => renderHeartbeat(node)
    },
    {
      title: 'CPU',
      key: 'cpu',
      width: 150,
      render: (_: unknown, node) => <UsageMeter percent={cpuPercent(node)} />
    },
    {
      title: 'Память',
      key: 'memory',
      width: 170,
      render: (_: unknown, node) => (
        <UsageMeter
          percent={memoryPercent(node)}
          caption={`${formatBytes(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree))} / ${formatBytes(node.systemMemoryTotal)}`}
        />
      )
    },
    {
      title: 'Диск',
      key: 'disk',
      width: 170,
      responsive: ['xl'],
      render: (_: unknown, node) => (
        <UsageMeter
          percent={diskPercent(node)}
          caption={`${formatBytes(calculateUsed(node.diskTotal, node.diskFree))} / ${formatBytes(node.diskTotal)}`}
        />
      )
    },
    {
      title: 'Heap',
      key: 'heap',
      width: 170,
      responsive: ['xxl'],
      render: (_: unknown, node) => (
        <UsageMeter
          percent={formatPercent(node.heapUsed, node.heapMax)}
          caption={`${formatBytes(node.heapUsed)} / ${formatBytes(node.heapMax)}`}
        />
      )
    },
    {
      title: 'Аптайм',
      dataIndex: 'uptimeSeconds',
      width: 110,
      responsive: ['xl'],
      render: (value?: number) => (
        <Typography.Text type="secondary" style={styles.tabularNumbers}>
          {formatDuration(value)}
        </Typography.Text>
      )
    },
    {
      title: '',
      key: 'open',
      width: 48,
      align: 'right',
      render: () => <RightOutlined style={styles.chevron} />
    }
  ];

  const emptyState = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text strong>Узлы не найдены</Typography.Text>
          <Typography.Text type="secondary">
            Узлы появляются здесь сами, когда экземпляр приложения начинает отправлять метрики.
          </Typography.Text>
        </Space>
      }
    />
  );

  return (
    <div style={styles.page}>
      <PageHeader
        title="Узлы"
        subtitle={
          <Space size={6} wrap>
            <span>{pluralize(list.length, ['узел', 'узла', 'узлов'])} под наблюдением</span>
            {lastUpdated && (
              <Typography.Text type="secondary">
                · обновлено в {formatTime(lastUpdated)}
              </Typography.Text>
            )}
          </Space>
        }
        actions={
          <Button size="large" icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
            Обновить
          </Button>
        }
      />

      <div style={styles.stats}>
        <StatTile
          label="Узлов"
          value={stats.total}
          icon={<CloudServerOutlined />}
          loading={loading && !list.length}
        />
        <StatTile
          label="В сети"
          value={stats.online}
          icon={<WifiOutlined />}
          accent={styles.accents.online}
          loading={loading && !list.length}
        />
        <StatTile
          label="Без сигнала"
          value={stats.offline}
          icon={<DisconnectOutlined />}
          accent={stats.offline > 0 ? styles.accents.offline : undefined}
          loading={loading && !list.length}
        />
        <StatTile
          label="Средний CPU"
          value={stats.avgCpu === undefined ? '—' : `${stats.avgCpu}%`}
          icon={<ThunderboltOutlined />}
          accent={styles.accents.cpu}
          loading={loading && !list.length}
        />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось получить метрики узлов"
          description={error}
          style={styles.alert}
        />
      )}

      {isMobile ? (
        <Space direction="vertical" size={12} style={styles.mobileList}>
          {list.length === 0 && !loading ? (
            <div style={styles.emptyWrapper}>{emptyState}</div>
          ) : (
            list.map((node) => (
              <div
                key={node.id}
                style={styles.mobileCard}
                onClick={() => openNode(node.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => event.key === 'Enter' && openNode(node.id)}
              >
                <div style={styles.mobileHeader}>
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{node.nodeKey}</Typography.Text>
                    <Typography.Text type="secondary" style={styles.hint}>
                      {node.hostname || '—'}
                      {node.port ? `:${node.port}` : ''} · {node.ip || 'IP неизвестен'}
                    </Typography.Text>
                  </Space>
                  {renderHeartbeat(node)}
                </div>

                <div style={styles.mobileMeters}>
                  <div>
                    <Typography.Text type="secondary" style={styles.meterLabel}>
                      CPU
                    </Typography.Text>
                    <UsageMeter percent={cpuPercent(node)} width={0} />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={styles.meterLabel}>
                      Память
                    </Typography.Text>
                    <UsageMeter
                      percent={memoryPercent(node)}
                      width={0}
                      caption={`${formatBytes(calculateUsed(node.systemMemoryTotal, node.systemMemoryFree))} / ${formatBytes(node.systemMemoryTotal)}`}
                    />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={styles.meterLabel}>
                      Диск
                    </Typography.Text>
                    <UsageMeter
                      percent={diskPercent(node)}
                      width={0}
                      caption={`${formatBytes(calculateUsed(node.diskTotal, node.diskFree))} / ${formatBytes(node.diskTotal)}`}
                    />
                  </div>
                </div>

                <div style={styles.mobileFooter}>
                  <Typography.Text type="secondary" style={styles.hint}>
                    Аптайм {formatDuration(node.uptimeSeconds)}
                  </Typography.Text>
                  <Typography.Link>Подробнее</Typography.Link>
                </div>
              </div>
            ))
          )}
        </Space>
      ) : (
        <Table<SystemNode>
          rowKey={(row) => row.id}
          dataSource={list}
          loading={loading && !list.length}
          columns={columns}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: emptyState }}
          style={styles.table}
          onRow={(node) => ({
            onClick: () => openNode(node.id),
            style: styles.clickableRow
          })}
        />
      )}
    </div>
  );
};
