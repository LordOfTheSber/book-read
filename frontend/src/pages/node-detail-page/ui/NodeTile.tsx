import React from 'react';
import { Card, Typography, theme } from 'antd';
import { usageLevel } from '@/shared/lib/format';
import { useNodeDetailPageStyles } from './NodeDetailPage.styles';

interface Props {
  label: string;
  /** 0–100; undefined — метрика недоступна. */
  percent?: number;
  /** Что стоит под полосой: «8,6 ГБ из 16 ГБ», «8 ядер · нагрузка 1,4». */
  hint?: React.ReactNode;
}

const BADGES: Record<'normal' | 'warning' | 'critical', string> = {
  normal: 'норма',
  warning: 'следить',
  critical: 'тревога'
};

/**
 * Плитка состояния узла: процент, словесная оценка, полоса и подпись с абсолютными числами.
 *
 * Одного процента мало: «68%» не отвечает на вопрос, надо ли что-то делать, а «124 ГБ свободно»
 * и метка «следить» — отвечают. Порог общий с таблицей узлов (см. {@code usageLevel}), чтобы
 * жёлтый на обзоре и жёлтый здесь значили одно и то же.
 */
export const NodeTile: React.FC<Props> = ({ label, percent, hint }) => {
  const { token } = theme.useToken();
  const styles = useNodeDetailPageStyles();
  const level = usageLevel(percent);
  const color =
    level === 'critical' ? token.colorError : level === 'warning' ? token.colorWarning : token.colorSuccess;

  return (
    <Card style={styles.tile} styles={{ body: styles.tileBody }}>
      <div style={styles.tileHead}>
        <Typography.Text type="secondary" style={styles.tileLabel}>
          {label}
        </Typography.Text>
        {percent !== undefined && (
          <span style={styles.tileBadge(color)}>{BADGES[level]}</span>
        )}
      </div>
      <div style={styles.tileValue}>{percent === undefined ? '—' : `${Math.round(percent)}%`}</div>
      <div style={styles.tileBar}>
        <span style={styles.tileBarFill(percent ?? 0, color)} />
      </div>
      {hint && (
        <Typography.Text type="secondary" style={styles.tileHint}>
          {hint}
        </Typography.Text>
      )}
    </Card>
  );
};
