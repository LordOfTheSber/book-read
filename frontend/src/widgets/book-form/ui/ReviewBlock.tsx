import React, { useState } from 'react';
import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';

interface Props {
  item: LibraryItem;
}

/**
 * Отзыв так, как его увидит читатель: спойлерная часть спрятана под кат и раскрывается
 * по явному нажатию. Ради этого она и хранится отдельным полем.
 */
export const ReviewBlock: React.FC<Props> = ({ item }) => {
  const [spoilerVisible, setSpoilerVisible] = useState(false);

  const criteria = ratingCriteria
    .map((criterion) => ({ label: criterion.label, value: item[criterion.key] }))
    .filter((criterion) => criterion.value !== undefined && criterion.value !== null);

  // Заметка тоже наполняет вкладку: без неё запись с одной приватной пометкой выглядела бы пустой.
  if (!item.review && !item.reviewSpoiler && !item.note && criteria.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Отзыва пока нет — его можно написать во вкладке «Карточка»"
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {criteria.length > 0 && (
        <Space size={[8, 8]} wrap>
          {criteria.map((criterion) => (
            <Tag key={criterion.label} bordered={false}>
              {criterion.label}: {criterion.value}
            </Tag>
          ))}
        </Space>
      )}

      {item.review && <Typography.Paragraph>{item.review}</Typography.Paragraph>}

      {item.reviewSpoiler && (
        <Card size="small" title="Со спойлерами">
          {spoilerVisible ? (
            <>
              <Typography.Paragraph>{item.reviewSpoiler}</Typography.Paragraph>
              <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => setSpoilerVisible(false)}>
                Скрыть
              </Button>
            </>
          ) : (
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSpoilerVisible(true)}>
              Показать спойлеры
            </Button>
          )}
        </Card>
      )}

      {item.note && (
        <Card size="small" title="Заметка (видна только вам)">
          <Typography.Paragraph style={{ marginBottom: 0 }}>{item.note}</Typography.Paragraph>
        </Card>
      )}
    </Space>
  );
};
