import React from 'react';
import { Card } from 'antd';
import { TypesManagerWidget } from '@/widgets/types-manager/ui/TypesManagerWidget';
import { useTypesPageStyles } from './TypesPage.styles';

export const TypesPage: React.FC = () => {
  const styles = useTypesPageStyles();

  return (
    <Card title="Типы книг" headStyle={styles.cardHead} bodyStyle={styles.cardBody} style={styles.cardStyle}>
      <TypesManagerWidget />
    </Card>
  );
};
