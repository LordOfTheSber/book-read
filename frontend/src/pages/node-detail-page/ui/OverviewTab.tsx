import React from 'react';
import { Card, Col, Empty, Row, Skeleton, Typography } from 'antd';
import { NodeMemoryDetail, SystemNode } from '@/shared/types/library';
import { MetricList } from '@/shared/ui/MetricList';
import { UsageMeter } from '@/shared/ui/UsageMeter';
import { calculateUsed, formatBytes, formatDuration, formatPercent } from '@/shared/lib/format';
import { formatDateTime } from '@/shared/lib/date';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

interface Props {
  node?: SystemNode;
  memoryDetail?: NodeMemoryDetail;
  memoryDetailLoading: boolean;
}

export const OverviewTab: React.FC<Props> = ({ node, memoryDetail, memoryDetailLoading }) => {
  const styles = useNodeDetailPageStyles();

  const memoryUsed = calculateUsed(node?.systemMemoryTotal, node?.systemMemoryFree);
  const diskUsed = calculateUsed(node?.diskTotal, node?.diskFree);

  const resource = (
    title: string,
    percent: number | undefined,
    rows: { label: string; value: React.ReactNode }[]
  ) => (
    <Card title={title} style={styles.card} styles={{ body: styles.cardBody }}>
      <div style={styles.meterBlock}>
        <UsageMeter percent={percent} width={0} />
      </div>
      <MetricList items={rows.map((row) => ({ ...row, mono: true }))} />
    </Card>
  );

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="Об узле" style={styles.card} styles={{ body: styles.cardBody }}>
          <MetricList
            items={[
              { label: 'Хост', value: node?.hostname || '—', mono: true },
              { label: 'IP-адрес', value: node?.ip || '—', mono: true },
              { label: 'Порт', value: node?.port ?? '—', mono: true },
              { label: 'Аптайм', value: formatDuration(node?.uptimeSeconds) },
              {
                label: 'Последний отчёт',
                value: node?.lastReportedAt ? formatDateTime(node.lastReportedAt) : '—'
              }
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        {resource('Системная память', formatPercent(memoryUsed, node?.systemMemoryTotal), [
          { label: 'Использовано', value: formatBytes(memoryUsed) },
          { label: 'Свободно', value: formatBytes(node?.systemMemoryFree) },
          { label: 'Всего', value: formatBytes(node?.systemMemoryTotal) }
        ])}
      </Col>

      <Col xs={24} lg={12}>
        {resource('Heap (JVM/Node)', formatPercent(node?.heapUsed, node?.heapMax), [
          { label: 'Использовано', value: formatBytes(node?.heapUsed) },
          { label: 'Committed', value: formatBytes(node?.heapCommitted) },
          { label: 'Максимум', value: formatBytes(node?.heapMax) }
        ])}
      </Col>

      <Col xs={24} lg={12}>
        {resource('Дисковое пространство', formatPercent(diskUsed, node?.diskTotal), [
          { label: 'Использовано', value: formatBytes(diskUsed) },
          { label: 'Свободно', value: formatBytes(node?.diskFree) },
          { label: 'Всего', value: formatBytes(node?.diskTotal) }
        ])}
      </Col>

      <Col xs={24}>
        <Card title="Память процесса Node.js" style={styles.card} styles={{ body: styles.cardBody }}>
          {memoryDetailLoading && !memoryDetail ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : memoryDetail?.memoryUsage ? (
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <MetricList
                  items={[
                    { label: 'RSS (resident set size)', value: formatBytes(memoryDetail.memoryUsage.rss), mono: true },
                    { label: 'Heap total', value: formatBytes(memoryDetail.memoryUsage.heapTotal), mono: true },
                    { label: 'Heap used', value: formatBytes(memoryDetail.memoryUsage.heapUsed), mono: true },
                    { label: 'External', value: formatBytes(memoryDetail.memoryUsage.external), mono: true },
                    {
                      label: 'Array buffers',
                      value: formatBytes(memoryDetail.memoryUsage.arrayBuffers),
                      mono: true
                    }
                  ]}
                />
              </Col>
              {memoryDetail.v8HeapStatistics && (
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary" style={styles.hint}>
                    V8 heap statistics
                  </Typography.Text>
                  <MetricList
                    items={[
                      { label: 'Total heap size', value: formatBytes(memoryDetail.v8HeapStatistics.totalHeapSize), mono: true },
                      { label: 'Used heap size', value: formatBytes(memoryDetail.v8HeapStatistics.usedHeapSize), mono: true },
                      { label: 'Heap size limit', value: formatBytes(memoryDetail.v8HeapStatistics.heapSizeLimit), mono: true },
                      { label: 'Total available', value: formatBytes(memoryDetail.v8HeapStatistics.totalAvailableSize), mono: true },
                      { label: 'Total physical', value: formatBytes(memoryDetail.v8HeapStatistics.totalPhysicalSize), mono: true },
                      { label: 'Malloced', value: formatBytes(memoryDetail.v8HeapStatistics.mallocedMemory), mono: true },
                      { label: 'Peak malloced', value: formatBytes(memoryDetail.v8HeapStatistics.peakMallocedMemory), mono: true }
                    ]}
                  />
                </Col>
              )}
            </Row>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Узел не присылает данные о памяти процесса"
            />
          )}
        </Card>
      </Col>
    </Row>
  );
};
