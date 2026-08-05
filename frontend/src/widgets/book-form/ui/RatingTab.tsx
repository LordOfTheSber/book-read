import React from 'react';
import { Col, Divider, Form, Input, Rate, Row, Space, Typography, theme } from 'antd';
import type { FormInstance } from 'antd';
import { EyeInvisibleOutlined, LockOutlined } from '@ant-design/icons';
import { LibraryItem } from '@/shared/types/library';
import { ratingCriteria } from '@/shared/constants/ratingCriteria';
import { formatScore } from '@/shared/lib/format';
import { ReviewBlock } from './ReviewBlock';

interface Props {
  /** Сохранённая запись: поверх неё накладываются несохранённые значения формы. */
  item: LibraryItem | null;
  form: FormInstance;
}

interface ScoreInputProps {
  value?: number;
  onChange?: (value?: number) => void;
  size?: number;
}

/**
 * Звёзды с числом рядом. Без числа десять звёзд с половинками читаются как загадка:
 * «это восемь или восемь с половиной».
 */
const ScoreInput: React.FC<ScoreInputProps> = ({ value, onChange, size = 20 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <Rate
      allowClear
      allowHalf
      count={10}
      value={value ?? 0}
      // Сброс приходит нулём; наружу он должен уйти пустым значением, а не оценкой «0».
      onChange={(next) => onChange?.(next || undefined)}
      style={{ fontSize: size }}
    />
    <Typography.Text type={value ? undefined : 'secondary'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value ? `${formatScore(value)} / 10` : 'не оценено'}
    </Typography.Text>
  </span>
);

/**
 * Оценки и мнения (раздел 4 роадмапа) целиком: и ввод, и то, как запись выглядит после
 * сохранения. Раньше поля отзыва жили на вкладке «Карточка», а вкладка «Отзыв» умела только
 * показывать — и отправляла обратно за правкой.
 */
export const RatingTab: React.FC<Props> = ({ item, form }) => {
  const { token } = theme.useToken();
  // Предпросмотр строится по текущим значениям формы: кат со спойлерами виден до сохранения.
  const values = Form.useWatch([], form) ?? {};
  const preview = { ...(item ?? {}), ...values } as LibraryItem;

  return (
    <Space direction="vertical" size={0} style={{ display: 'flex' }}>
      <Form.Item name="rating" label="Общая оценка" tooltip="Полшага доступны — 7.5 тоже валидная оценка">
        <ScoreInput />
      </Form.Item>

      <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        По критериям
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
        Необязательны, и общая оценка из них не складывается: вес у каждого критерия свой.
      </Typography.Paragraph>
      <Row gutter={[16, 0]}>
        {ratingCriteria.map((criterion) => (
          <Col xs={24} xl={12} key={criterion.key}>
            <Form.Item name={criterion.key} label={criterion.label}>
              <ScoreInput size={16} />
            </Form.Item>
          </Col>
        ))}
      </Row>

      <Divider style={{ marginTop: 0 }} />

      {/* Заметка и отзыв разделены: первая для себя, второй — то, что не стыдно показать. */}
      <Form.Item
        name="note"
        label={
          <Space size={6}>
            <LockOutlined style={{ color: token.colorTextTertiary }} />
            Заметка
          </Space>
        }
        tooltip="Видна только вам и не попадёт в публичный отзыв"
      >
        <Input.TextArea rows={3} placeholder="На чём остановились, что купить, о чём не забыть" />
      </Form.Item>

      <Form.Item name="review" label="Отзыв" tooltip="Публичная часть — без спойлеров">
        <Input.TextArea rows={5} placeholder="Впечатление, которое можно показать другим" />
      </Form.Item>

      <Form.Item
        name="reviewSpoiler"
        label={
          <Space size={6}>
            <EyeInvisibleOutlined style={{ color: token.colorWarning }} />
            Под спойлер-катом
          </Space>
        }
        tooltip="Эта часть спрятана, пока читатель сам её не раскроет"
      >
        <Input.TextArea rows={3} placeholder="Развязка, повороты, финал" />
      </Form.Item>

      <Divider orientation="left" plain style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Так запись выглядит после сохранения
        </Typography.Text>
      </Divider>

      <div
        style={{
          padding: 16,
          borderRadius: token.borderRadiusLG,
          border: `1px dashed ${token.colorBorder}`
        }}
      >
        <ReviewBlock item={preview} />
      </div>
    </Space>
  );
};
