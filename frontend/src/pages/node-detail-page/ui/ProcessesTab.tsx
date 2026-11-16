import React, { useMemo } from 'react';
import { Card, Empty, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { NodeMemoryDetail, ProcessInfo } from '@/shared/types/library';
import { formatBytes } from '@/shared/lib/format';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

interface Props {
  memoryDetail?: NodeMemoryDetail;
  loading: boolean;
}

const percent = (value?: number | null) =>
  value === undefined || value === null ? '—' : `${value.toFixed(1)}%`;

export const ProcessesTab: React.FC<Props> = ({ memoryDetail, loading }) => {
  const styles = useNodeDetailPageStyles();
  const processes = memoryDetail?.topProcessesByMemory ?? [];

  const columns: ColumnsType<ProcessInfo> = useMemo(
    () => [
      {
        title: 'Процесс',
        dataIndex: 'command',
        ellipsis: true,
        render: (command: string, process) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong ellipsis={{ tooltip: command }}>
              {command}
            </Typography.Text>
            <Typography.Text type="secondary" style={styles.hint}>
              PID {process.pid} · {process.user}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: 'CPU',
        dataIndex: 'cpuPercent',
        width: 90,
        align: 'right',
        render: (value?: number) => <span style={styles.tabularNumbers}>{percent(value)}</span>
      },
      {
        title: 'Память',
        dataIndex: 'memoryPercent',
        width: 100,
        align: 'right',
        render: (value: number | null) => <span style={styles.tabularNumbers}>{percent(value)}</span>
      },
      {
        title: 'RSS',
        dataIndex: 'residentMemoryKb',
        width: 110,
        align: 'right',
        render: (kb: number) => <span style={styles.tabularNumbers}>{formatBytes(kb * 1024)}</span>
      },
      {
        title: 'VSZ',
        dataIndex: 'virtualMemoryKb',
        width: 110,
        align: 'right',
        responsive: ['lg'],
        render: (kb: number) => <span style={styles.tabularNumbers}>{formatBytes(kb * 1024)}</span>
      }
    ],
    [styles]
  );

  if (loading && !memoryDetail) {
    return (
      <Card style={styles.card} styles={{ body: styles.cardBody }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (processes.length === 0) {
    return (
      <Card style={styles.card} styles={{ body: styles.cardBody }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text strong>Данных о процессах нет</Typography.Text>
              <Typography.Text type="secondary">
                Список процессов доступен только на сервере, где запущено приложение.
              </Typography.Text>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Typography.Text type="secondary" style={styles.hint}>
        Топ процессов по потреблению памяти на этом узле
      </Typography.Text>
      <Table<ProcessInfo>
        dataSource={processes}
        columns={columns}
        rowKey={(row) => `${row.pid}-${row.command}`}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
        style={{ ...styles.table, marginTop: 12 }}
      />
    </>
  );
};
