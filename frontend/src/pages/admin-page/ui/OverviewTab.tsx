import React from 'react';
import { Badge, Button, Empty, Space, Typography } from 'antd';
import { FileOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UsageMeter } from '@/shared/ui/UsageMeter';
import {
  nodeCpuPercent,
  nodeDiskPercent,
  nodeHeapPercent,
  nodeHeartbeat,
  nodeMemoryPercent
} from '@/entities/node';
import { ExportFileInfo, SystemNode } from '@/shared/types/library';
import { formatDateTime } from '@/shared/lib/date';
import { formatBytes, formatDuration } from '@/shared/lib/format';
import { useAdminStyles } from './AdminPage.styles';

interface Props {
  nodes: SystemNode[];
  backups: ExportFileInfo[];
  /** Переход на вкладку копий: снять копию можно только там, где написано, чем это грозит. */
  onOpenBackups: () => void;
}

/** Четыре метрики узла в ряд — те же, что на его собственной странице. */
const METERS: Array<{ label: string; percent: (node: SystemNode) => number | undefined }> = [
  { label: 'CPU', percent: nodeCpuPercent },
  { label: 'Память', percent: nodeMemoryPercent },
  { label: 'Диск', percent: nodeDiskPercent },
  { label: 'Heap', percent: nodeHeapPercent }
];

/**
 * Обзор администрирования по макету `Admin`: узлы и копии рядом.
 *
 * «Узлы» были отдельным пунктом меню со своей таблицей и своими плитками — второй из двух
 * администраторских пунктов в шапке. Здесь от них остаётся то, ради чего их открывали: жив ли
 * узел и не кончается ли у него место. Подробности — на странице узла, по нажатию.
 */
export const OverviewTab: React.FC<Props> = ({ nodes, backups, onOpenBackups }) => {
  const styles = useAdminStyles();
  const navigate = useNavigate();

  return (
    <div style={styles.columns}>
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <Typography.Text strong>Узлы</Typography.Text>
          <Typography.Text type="secondary" style={styles.hint}>
            пульс раз в десять секунд
          </Typography.Text>
        </div>

        {nodes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Typography.Text type="secondary">
                Узлы появляются здесь сами, когда экземпляр приложения начинает отправлять метрики.
              </Typography.Text>
            }
          />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {nodes.map((node) => {
              const hb = nodeHeartbeat(node.lastReportedAt);
              return (
                <div
                  key={node.id}
                  style={styles.node}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/nodes/${node.id}`)}
                  onKeyDown={(event) => event.key === 'Enter' && navigate(`/nodes/${node.id}`)}
                >
                  <div style={styles.nodeHead}>
                    <Badge status={hb.status} />
                    <Typography.Text strong>{node.nodeKey}</Typography.Text>
                    <Typography.Text type="secondary" style={styles.hint}>
                      {node.ip || 'IP неизвестен'}
                    </Typography.Text>
                    <span style={{ flex: 1 }} />
                    <Typography.Text type="secondary" style={styles.hint}>
                      {hb.state === 'online' ? formatDuration(node.uptimeSeconds) : hb.text}
                    </Typography.Text>
                    <RightOutlined style={{ color: 'inherit', opacity: 0.4 }} />
                  </div>
                  <div style={styles.meters}>
                    {METERS.map((meter) => (
                      <div key={meter.label}>
                        <Typography.Text type="secondary" style={styles.meterLabel}>
                          {meter.label}
                        </Typography.Text>
                        <UsageMeter percent={meter.percent(node)} width={0} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Space>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.cardHead}>
          <Typography.Text strong>Резервные копии</Typography.Text>
          <Button size="small" onClick={onOpenBackups}>
            Все копии
          </Button>
        </div>

        {backups.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Typography.Text type="secondary">Копий пока нет.</Typography.Text>}
          />
        ) : (
          backups.slice(0, 4).map((file, index, shown) => (
            <div key={file.fileName} style={styles.listRow(index === shown.length - 1)}>
              <span style={styles.fileIcon}>
                <FileOutlined />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text
                  style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {file.fileName}
                </Typography.Text>
                <Typography.Text type="secondary" style={styles.hint}>
                  {formatDateTime(file.lastModifiedAt)} · {formatBytes(file.sizeBytes)}
                </Typography.Text>
              </span>
            </div>
          ))
        )}

        <div style={styles.danger}>
          Восстановление из копии заменяет данные всех пользователей и не отменяется ничем — поэтому
          оно живёт на своей вкладке, а не кнопкой в этом списке.
        </div>
      </div>
    </div>
  );
};
