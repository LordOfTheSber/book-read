import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Badge, Button, Space, Spin, Tabs, Typography } from 'antd';
import {
  ApiOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  HddOutlined,
  PartitionOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { clearCurrentNode, downloadNodeLogs, loadNodeById, loadNodeMemoryDetail } from '@/entities/node';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatTile } from '@/shared/ui/StatTile';
import { isSuperAdmin } from '@/shared/lib/roles';
import { useRequestError } from '@/shared/lib/errors';
import { parseServerDate } from '@/shared/lib/date';
import { calculateUsed, formatDuration, formatPercent, usageLevel } from '@/shared/lib/format';
import { OverviewTab } from './OverviewTab';
import { RequestsTab } from './RequestsTab';
import { ProcessesTab } from './ProcessesTab';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

const POLL_INTERVAL_MS = 10_000;

const heartbeat = (lastReportedAt?: string) => {
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
  const { message } = App.useApp();
  const showRequestError = useRequestError();

  const { currentNode, currentNodeLoading, memoryDetail, memoryDetailLoading, error } = useAppSelector(
    (state) => state.nodes
  );
  const role = useAppSelector((state) => state.auth.user?.role);

  const [downloadingLogs, setDownloadingLogs] = useState(false);
  // Опрос идёт каждые 10 секунд; спиннер показываем только на ручное обновление.
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    if (!nodeId) return;
    dispatch(loadNodeById(nodeId));
    dispatch(loadNodeMemoryDetail(nodeId));
  }, [dispatch, nodeId]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      dispatch(clearCurrentNode());
    };
  }, [dispatch, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(loadNodeById(nodeId as string)),
        dispatch(loadNodeMemoryDetail(nodeId as string))
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadLogs = async () => {
    if (!nodeId) return;
    setDownloadingLogs(true);
    try {
      await downloadNodeLogs(nodeId);
      message.success('Логи скачаны');
    } catch (err) {
      showRequestError(err, 'Не удалось скачать логи узла');
    } finally {
      setDownloadingLogs(false);
    }
  };

  if (currentNodeLoading && !currentNode) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const backLink = (
    <Typography.Link onClick={() => navigate('/nodes')} style={styles.backLink}>
      <ArrowLeftOutlined /> Все узлы
    </Typography.Link>
  );

  if (error && !currentNode) {
    return (
      <div style={styles.page}>
        {backLink}
        <Alert type="error" showIcon message="Не удалось загрузить узел" description={error} />
      </div>
    );
  }

  const node = currentNode;
  const hb = heartbeat(node?.lastReportedAt);
  const cpu =
    node?.cpuLoad === undefined || node?.cpuLoad === null || node.cpuLoad < 0
      ? undefined
      : Number((node.cpuLoad * 100).toFixed(1));
  const memory = formatPercent(
    calculateUsed(node?.systemMemoryTotal, node?.systemMemoryFree),
    node?.systemMemoryTotal
  );
  const disk = formatPercent(calculateUsed(node?.diskTotal, node?.diskFree), node?.diskTotal);

  const accentFor = (percent?: number) => {
    const level = usageLevel(percent);
    return level === 'critical'
      ? styles.accents.error
      : level === 'warning'
        ? styles.accents.warning
        : styles.accents.ok;
  };

  const tabs = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined /> Обзор
        </span>
      ),
      children: (
        <OverviewTab node={node} memoryDetail={memoryDetail} memoryDetailLoading={memoryDetailLoading} />
      )
    },
    {
      key: 'requests',
      label: (
        <span>
          <ApiOutlined /> Запросы
        </span>
      ),
      children: <RequestsTab nodeKey={node?.nodeKey} role={role} />
    },
    {
      key: 'processes',
      label: (
        <span>
          <PartitionOutlined /> Процессы
        </span>
      ),
      children: <ProcessesTab memoryDetail={memoryDetail} loading={memoryDetailLoading} />
    }
  ];

  return (
    <div style={styles.page}>
      {backLink}

      <PageHeader
        title={
          <Space size={12} align="center" wrap>
            <span>{node?.nodeKey || 'Узел'}</span>
            <Badge status={hb.status} text={<Typography.Text type="secondary">{hb.text}</Typography.Text>} />
          </Space>
        }
        subtitle={
          <span style={styles.tabularNumbers}>
            {node?.hostname || '—'}
            {node?.port ? `:${node.port}` : ''} · {node?.ip || 'IP неизвестен'}
          </span>
        }
        actions={
          <>
            <Button size="large" icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
              Обновить
            </Button>
            {isSuperAdmin(role) && (
              <Button
                size="large"
                type="primary"
                icon={<DownloadOutlined />}
                loading={downloadingLogs}
                onClick={handleDownloadLogs}
              >
                Скачать логи
              </Button>
            )}
          </>
        }
      />

      <div style={styles.stats}>
        <StatTile
          label="CPU"
          value={cpu === undefined ? '—' : `${cpu}%`}
          icon={<ThunderboltOutlined />}
          accent={accentFor(cpu)}
        />
        <StatTile
          label="Память"
          value={memory === undefined ? '—' : `${Math.round(memory)}%`}
          icon={<DatabaseOutlined />}
          accent={accentFor(memory)}
        />
        <StatTile
          label="Диск"
          value={disk === undefined ? '—' : `${Math.round(disk)}%`}
          icon={<HddOutlined />}
          accent={accentFor(disk)}
        />
        <StatTile
          label="Аптайм"
          value={formatDuration(node?.uptimeSeconds)}
          icon={<ClockCircleOutlined />}
          accent={styles.accents.uptime}
        />
      </div>

      <Tabs items={tabs} />
    </div>
  );
};
