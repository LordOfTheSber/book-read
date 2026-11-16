import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Breadcrumb, Button, Grid, Space, Spin, Tabs, Typography } from 'antd';
import { ApiOutlined, DashboardOutlined, DownloadOutlined, PartitionOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import {
  clearCurrentNode,
  downloadNodeLogs,
  loadNodeById,
  loadNodeMemoryDetail,
  nodeCpuPercent,
  nodeDiskPercent,
  nodeHeapPercent,
  nodeHeartbeat,
  nodeMemoryPercent
} from '@/entities/node';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatusDot } from '@/shared/ui/StatusDot';
import { isSuperAdmin } from '@/shared/lib/roles';
import { useRequestError } from '@/shared/lib/errors';
import { formatBytes, formatDuration } from '@/shared/lib/format';
import { AboutCard } from './AboutCard';
import { NodeTile } from './NodeTile';
import { OverviewTab } from './OverviewTab';
import { PingCard } from './PingCard';
import { RequestsTab } from './RequestsTab';
import { ProcessesTab } from './ProcessesTab';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

const POLL_INTERVAL_MS = 10_000;

/**
 * Страница узла по макету `NodeDetail.dc.html`: состояние плитками, паспорт и общие настройки
 * проверки слева, вкладки с метриками справа.
 *
 * Настройки пинга лежали внутри вкладки «Запросы» одного узла, хотя относятся ко всем сразу,
 * а «что это за машина» приходилось собирать из подписей заголовка.
 */
export const NodeDetailPage: React.FC = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const screens = Grid.useBreakpoint();
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

  /** Хлебные крошки вместо «← Все узлы»: узлы теперь живут внутри администрирования. */
  const backLink = (
    <Breadcrumb
      style={styles.backLink}
      items={[
        { title: <Typography.Link onClick={() => navigate('/admin')}>Администрирование</Typography.Link> },
        { title: <Typography.Link onClick={() => navigate('/admin')}>Узлы</Typography.Link> },
        { title: currentNode?.nodeKey ?? 'Узел' }
      ]}
    />
  );

  if (error && !currentNode) {
    return (
      <div>
        {backLink}
        <Alert type="error" showIcon message="Не удалось загрузить узел" description={error} />
      </div>
    );
  }

  const node = currentNode;
  const hb = nodeHeartbeat(node?.lastReportedAt);
  const cpu = nodeCpuPercent(node);
  const memory = nodeMemoryPercent(node);
  const disk = nodeDiskPercent(node);
  const heap = nodeHeapPercent(node);

  /** «8,6 ГБ из 16 ГБ» — абсолютные числа отвечают на вопрос «надо ли что-то делать», процент нет. */
  const used = (total?: number, free?: number) =>
    total === undefined || free === undefined ? undefined : `${formatBytes(total - free)} из ${formatBytes(total)}`;

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
      children: <RequestsTab nodeKey={node?.nodeKey} />
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
    <div>
      {backLink}

      <PageHeader
        documentTitle={node?.nodeKey ? `Узел ${node.nodeKey}` : 'Узел'}
        title={
          <Space size={12} align="center" wrap>
            <span>{node?.nodeKey || 'Узел'}</span>
            <StatusDot status={hb.status} label={hb.text} />
          </Space>
        }
        subtitle={
          <span style={styles.tabularNumbers}>
            {`${node?.ip || node?.hostname || 'адрес неизвестен'}${node?.port ? `:${node.port}` : ''}`}
            {` · пульс ${hb.text}`}
            {node?.uptimeSeconds !== undefined ? ` · аптайм ${formatDuration(node.uptimeSeconds)}` : ''}
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

      <div style={styles.tiles}>
        <NodeTile label="CPU" percent={cpu} hint={cpu === undefined ? 'метрика недоступна' : 'загрузка процессора'} />
        <NodeTile label="Память" percent={memory} hint={used(node?.systemMemoryTotal, node?.systemMemoryFree)} />
        <NodeTile label="Диск" percent={disk} hint={
          node?.diskFree !== undefined ? `${formatBytes(node.diskFree)} свободно` : undefined
        } />
        <NodeTile label="Heap" percent={heap} hint={
          node?.heapUsed !== undefined && node?.heapMax !== undefined
            ? `${formatBytes(node.heapUsed)} из ${formatBytes(node.heapMax)}`
            : undefined
        } />
      </div>

      <div style={screens.xl ? styles.columns : styles.columnsNarrow}>
        <div style={styles.side}>
          <PingCard role={role} onChanged={loadData} />
          <AboutCard node={node} />
        </div>

        <div style={{ minWidth: 0 }}>
          <Tabs items={tabs} />
        </div>
      </div>
    </div>
  );
};
