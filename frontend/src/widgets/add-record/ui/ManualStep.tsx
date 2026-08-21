import React from 'react';
import { Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import { MediaKind, ProgressUnit, ReadingStatus } from '@/shared/types/library';
import { ChoiceChips } from '@/shared/ui/ChoiceChips';
import { statusOptions } from '@/shared/constants/status';
import { mediaKindMeta } from '@/shared/constants/mediaKind';
import {
  progressUnitLabel,
  progressUnitName,
  progressUnitOptions,
  resolveProgressUnit
} from '@/shared/constants/format';

interface Props {
  authorOptions: Array<{ label: string; value: string }>;
  kind?: MediaKind;
  unit?: ProgressUnit;
  isMobile: boolean;
}

/**
 * Порядок чипов свой, не как в фильтрах: у новой записи «В планах» — значение по умолчанию,
 * и стоять оно должно первым, а не последним в общем списке статусов.
 */
const ADD_STATUS_ORDER: ReadingStatus[] = ['PLANNED', 'READING', 'COMPLETED', 'ON_HOLD', 'DROPPED'];

const statusChipOptions = ADD_STATUS_ORDER.map((value) => ({
  label: statusOptions.find((option) => option.value === value)?.label ?? value,
  value
}));
const kindChipOptions = (Object.keys(mediaKindMeta) as MediaKind[]).map((value) => ({
  label: mediaKindMeta[value].label,
  value
}));

/**
 * Ручной ввод — шесть полей, обязательное одно: название.
 *
 * Прежняя форма создания спрашивала 31 поле в одном свитке. Обложка, ISBN, год, переводчик, шкаф,
 * цена, оценка и отзыв к появлению записи в библиотеке отношения не имеют и переехали в карточку.
 */
export const ManualStep: React.FC<Props> = ({ authorOptions, kind, unit, isMobile }) => {
  const effectiveUnit = resolveProgressUnit({ kind, progressUnit: unit });
  const size = isMobile ? 'large' : 'middle';

  return (
    <Space direction="vertical" size={isMobile ? 14 : 16} style={{ display: 'flex' }}>
      <Form.Item
        name="title"
        label="Название"
        rules={[{ required: true, message: 'Название обязательно' }]}
        style={{ marginBottom: 0 }}
      >
        <Input placeholder="Например, «Задача трёх тел»" size="large" />
      </Form.Item>

      {/* Автора можно ввести с клавиатуры: незнакомое имя заведётся на сервере само. */}
      <Form.Item name="authorNames" label="Авторы" style={{ marginBottom: 0 }}>
        <Select
          mode="tags"
          allowClear
          placeholder="Начните вводить имя"
          options={authorOptions}
          tokenSeparators={[',']}
          size={size}
        />
      </Form.Item>

      <Form.Item name="kind" label="Вид" style={{ marginBottom: 0 }}>
        <ChoiceChips options={kindChipOptions} ariaLabel="Вид" size={isMobile ? 'large' : 'default'} />
      </Form.Item>

      <Form.Item name="status" label="Статус" style={{ marginBottom: 0 }}>
        <ChoiceChips options={statusChipOptions} ariaLabel="Статус" size={isMobile ? 'large' : 'default'} />
      </Form.Item>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Form.Item
          name="progressTotal"
          label="Объём — шкала прогресса"
          style={{ flex: '1 1 160px', minWidth: 0, marginBottom: 0 }}
        >
          <InputNumber
            min={1}
            style={{ width: '100%' }}
            placeholder="400"
            suffix={progressUnitLabel[effectiveUnit]}
            size={size}
          />
        </Form.Item>
        <Form.Item name="progressUnit" label="Единица" style={{ flex: '1 1 160px', minWidth: 0, marginBottom: 0 }}>
          <Select
            allowClear
            placeholder={`${progressUnitName[effectiveUnit]} — по виду`}
            options={progressUnitOptions}
            size={size}
          />
        </Form.Item>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Обложка, ISBN, год, переводчик, шкаф, цена, оценка и отзыв — в карточке записи. Чтобы запись
        появилась в библиотеке, они не нужны.
      </Typography.Text>
    </Space>
  );
};
