import React, { useState } from 'react';
import { Button, Empty, Space, Typography, theme } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined, LockOutlined, StarFilled, WarningOutlined } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { criteriaValues } from '@/shared/lib/rating';
import { formatScore } from '@/shared/lib/format';

interface Props {
  item: LibraryItem;
}

/**
 * Оценка по критерию плашкой: подпись слева, число справа.
 *
 * Незаполненный критерий показывается прочерком, а не пропадает: читателю видно, что автор
 * разбирал книгу по частям и до финала оценка не дошла — это тоже сведение.
 */
const CriterionBox: React.FC<{ label: string; value?: number }> = ({ label, value }) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '9px 12px',
        borderRadius: token.borderRadius,
        background: token.colorFillQuaternary
      }}
    >
      <Typography.Text style={{ fontSize: 13 }}>{label}</Typography.Text>
      <Typography.Text
        type={value === undefined ? 'secondary' : undefined}
        style={{ fontWeight: value === undefined ? 400 : 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {value === undefined ? '—' : formatScore(value)}
      </Typography.Text>
    </div>
  );
};

/**
 * Отзыв так, как его увидит читатель: спойлерная часть спрятана под кат и раскрывается
 * по явному нажатию. Ради этого она и хранится отдельным полем.
 */
export const ReviewBlock: React.FC<Props> = ({ item }) => {
  const { token } = theme.useToken();
  const [spoilerVisible, setSpoilerVisible] = useState(false);

  const criteria = criteriaValues(item);
  const hasCriteria = criteria.some((criterion) => criterion.value !== undefined);

  const score = formatScore(item.rating);

  // Заметка тоже наполняет вкладку: без неё запись с одной приватной пометкой выглядела бы пустой.
  if (!score && !item.review && !item.reviewSpoiler && !item.note && !hasCriteria) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Отзыва пока нет — поставьте оценку или напишите пару строк выше"
      />
    );
  }

  const panel: React.CSSProperties = {
    padding: 16,
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorFillQuaternary
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {(score || hasCriteria) && (
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {score && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <StarFilled style={{ color: token.colorWarning, fontSize: 20, alignSelf: 'center' }} />
              <Typography.Text style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {score}
              </Typography.Text>
              <Typography.Text type="secondary">/ 10</Typography.Text>
            </div>
          )}
          {hasCriteria && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {criteria.map((criterion) => (
                <CriterionBox key={criterion.key} label={criterion.label} value={criterion.value} />
              ))}
            </div>
          )}
        </div>
      )}

      {item.review && (
        <Typography.Paragraph style={{ marginBottom: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {item.review}
        </Typography.Paragraph>
      )}

      {item.reviewSpoiler && (
        <div style={{ ...panel, borderStyle: 'dashed', borderColor: token.colorWarningBorder }}>
          <Space size={8} style={{ marginBottom: spoilerVisible ? 12 : 8 }}>
            <WarningOutlined style={{ color: token.colorWarning }} />
            <Typography.Text strong>Со спойлерами</Typography.Text>
          </Space>
          {spoilerVisible ? (
            <>
              <Typography.Paragraph style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {item.reviewSpoiler}
              </Typography.Paragraph>
              <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => setSpoilerVisible(false)}>
                Скрыть
              </Button>
            </>
          ) : (
            <div>
              <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                Здесь развязка и повороты — откройте, если книга уже прочитана.
              </Typography.Paragraph>
              <Button size="small" icon={<EyeOutlined />} onClick={() => setSpoilerVisible(true)}>
                Показать спойлеры
              </Button>
            </div>
          )}
        </div>
      )}

      {item.note && (
        <div style={panel}>
          <Space size={8} style={{ marginBottom: 8 }}>
            <LockOutlined style={{ color: token.colorTextTertiary }} />
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Заметка — видна только вам
            </Typography.Text>
          </Space>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-line' }}>{item.note}</Typography.Paragraph>
        </div>
      )}
    </Space>
  );
};
