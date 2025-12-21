import React from 'react';
import { Card } from 'antd';
import { TypesManagerWidget } from '@/widgets/types-manager/ui/TypesManagerWidget';

export const TypesPage: React.FC = () => {
  return (
    <Card title="Book types">
      <TypesManagerWidget />
    </Card>
  );
};
