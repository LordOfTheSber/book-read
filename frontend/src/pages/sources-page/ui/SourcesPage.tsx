import React from 'react';
import { Card } from 'antd';
import { SourcesManagerWidget } from '@/widgets/sources-manager/ui/SourcesManagerWidget';
import { useSourcesPageStyles } from './SourcesPage.styles';

export const SourcesPage: React.FC = () => {
  const styles = useSourcesPageStyles();

  return (
    <Card title="Источники" bodyStyle={styles.cardBody} style={styles.cardStyle}>
      <SourcesManagerWidget />
    </Card>
  );
};
