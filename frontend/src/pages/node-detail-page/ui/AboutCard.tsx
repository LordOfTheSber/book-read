import React from 'react';
import { Card, Typography } from 'antd';
import { SystemNode } from '@/shared/types/library';
import { formatDateTime } from '@/shared/lib/date';
import { formatDuration } from '@/shared/lib/format';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

interface Props {
  node?: SystemNode | null;
}

/**
 * Паспорт узла: где он стоит, сколько работает и когда отчитывался.
 *
 * Всё это было рассыпано по подписям страницы — хост в заголовке, аптайм плиткой, последний
 * сигнал бейджем, — и собрать «что это за машина» приходилось глазами. Идентификатор узла
 * показан честно: узел заводит его себе сам при первом отчёте, это не секрет и не пароль.
 */
export const AboutCard: React.FC<Props> = ({ node }) => {
  const styles = useNodeDetailPageStyles();

  const rows: Array<{ label: string; value: React.ReactNode; mono?: boolean }> = [
    { label: 'Идентификатор', value: node?.nodeKey || '—', mono: true },
    { label: 'Хост', value: node?.hostname || '—', mono: true },
    { label: 'IP-адрес', value: node?.ip || '—', mono: true },
    { label: 'Порт', value: node?.port ?? '—', mono: true },
    { label: 'Аптайм', value: formatDuration(node?.uptimeSeconds) },
    { label: 'Последний отчёт', value: node?.lastReportedAt ? formatDateTime(node.lastReportedAt) : '—' }
  ];

  return (
    <Card style={styles.card} styles={{ body: styles.cardBody }} title="Об узле">
      {rows.map((row, index) => (
        <div key={row.label} style={styles.aboutRow(index === rows.length - 1)}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {row.label}
          </Typography.Text>
          <Typography.Text style={row.mono ? styles.mono : { fontSize: 13, fontWeight: 500 }}>
            {row.value}
          </Typography.Text>
        </div>
      ))}
    </Card>
  );
};
